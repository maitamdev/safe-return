import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 defaults to Turbopack; keep empty so webpack polyfills below still apply with `next dev --webpack`.
  turbopack: {},
  webpack: (config) => {
    // Wallet adapter / web3 polyfills for browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
      stream: false,
    };
    config.externals = [
      ...(Array.isArray(config.externals) ? config.externals : []),
      { "utf-8-validate": "commonjs utf-8-validate", bufferutil: "commonjs bufferutil" },
    ];
    return config;
  },
};

export default nextConfig;
