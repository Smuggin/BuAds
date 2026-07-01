/**
 * Password hashing — argon2id via @node-rs/argon2 (OWASP-aligned defaults).
 * Isolated here so swapping the algorithm is a one-file change. Server-only.
 *
 * An optional AUTH_PEPPER (env) is mixed into the password before hashing: extra
 * defense if the DB leaks, since the pepper lives only in env. Rotating it
 * invalidates all existing passwords.
 */
import { hash, verify } from "@node-rs/argon2";

// A real argon2id hash of a throwaway value, computed once on first use.
// verifyPassword() runs against this when a user/hash is missing so login timing
// is equal whether or not the account exists — defeats user enumeration via
// response time. Must be a genuine hash (not a literal) or verify() would reject
// it instantly and skip the KDF work that makes the timing match.
let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= hash("not-a-real-password");
  return dummyHashPromise;
}

function pepper(plain: string): string {
  const p = process.env.AUTH_PEPPER;
  return p ? plain + p : plain;
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(pepper(plain));
}

/** Constant-time verify. Pass `null` for a missing user to equalize timing. */
export async function verifyPassword(
  storedHash: string | null,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash ?? (await dummyHash()), pepper(plain));
  } catch {
    return false;
  }
}
