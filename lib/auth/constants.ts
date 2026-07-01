/** Shared auth constants — safe to import from both Edge (middleware) and Node. */

/** Name of the httpOnly cookie holding the opaque session token. */
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME ?? "adshub_session";

/** Sliding session lifetime — bumped on each verified use. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Absolute session lifetime cap, measured from createdAt — never extended. */
export const SESSION_ABS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Brute-force: failures before an account is temporarily locked. */
export const MAX_FAILED_LOGINS = 5;

/** Brute-force: how long an account stays locked after crossing the threshold. */
export const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
