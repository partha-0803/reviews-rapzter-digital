import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: path.join(process.cwd()),
  serverExternalPackages: ["@libsql/client", "libsql", "pg"],
};

export default nextConfig;
