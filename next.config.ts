import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['jsdom'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't include jsdom on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        jsdom: false,
        canvas: false,
        'utf-8-validate': false,
        bufferutil: false,
      };
    }
    return config;
  },
};

export default nextConfig;
