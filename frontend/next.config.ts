import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["uploadthing"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
