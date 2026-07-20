import { buildContentSecurityPolicy } from "./config/content-security-policy.mjs";

const contentSecurityPolicy = buildContentSecurityPolicy({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  nodeEnv: process.env.NODE_ENV
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  allowedDevOrigins: ["192.168.1.204"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
