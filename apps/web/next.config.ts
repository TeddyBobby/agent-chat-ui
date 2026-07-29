import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pi-agent/contracts"],
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
    ];
  },
};

export default nextConfig;
