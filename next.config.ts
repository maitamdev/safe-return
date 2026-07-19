import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const contentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' https: wss:;
  frame-src 'self' https:;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

const nextConfig: NextConfig = {
  // Next 16 defaults to Turbopack; keep empty so webpack polyfills below still apply with `next dev --webpack`.
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy.replace(/\s{2,}/g, " ").trim() },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
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
