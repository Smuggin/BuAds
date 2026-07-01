import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @node-rs/argon2 ships a native .node binary; keep it external so Next doesn't
  // try to bundle it into the server build (cf. password hashing in lib/auth).
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
