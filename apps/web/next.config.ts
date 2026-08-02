import type { NextConfig } from "next";

const desktopBuild = process.env.PI_AGENT_DESKTOP_BUILD === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@pi-agent/contracts"],
  ...(desktopBuild
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          return [
            {
              source: "/",
              destination: "/index.html",
            },
          ];
        },
      }),
};

export default nextConfig;
