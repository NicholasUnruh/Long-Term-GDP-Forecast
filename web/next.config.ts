import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  rewrites: async () => [
    { source: "/forecast/:path*", destination: `${apiUrl}/forecast/:path*` },
    { source: "/config/:path*", destination: `${apiUrl}/config/:path*` },
    { source: "/data/:path*", destination: `${apiUrl}/data/:path*` },
  ],
};

export default nextConfig;
