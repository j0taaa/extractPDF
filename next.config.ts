import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/auth/[...auth]": ["src/db/migrations/*"],
  },
};

export default nextConfig;
