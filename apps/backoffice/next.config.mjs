function buildConnectSources() {
  const sources = ["'self'"];
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (apiBaseUrl) {
    try {
      const parsed = new URL(apiBaseUrl);
      sources.push(parsed.origin);
      if (parsed.protocol === "https:") sources.push(`wss://${parsed.host}`);
      if (parsed.protocol === "http:") sources.push(`ws://${parsed.host}`);
    } catch {
      // Deployment readiness rejects invalid URLs. Keep the CSP closed here.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    sources.push(
      "http://localhost:4000",
      "ws://localhost:4000",
      "http://127.0.0.1:4000",
      "ws://127.0.0.1:4000"
    );
  }

  return Array.from(new Set(sources)).join(" ");
}

const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${isDevelopment ? " http:" : ""} https:`,
  "font-src 'self' data:",
  `connect-src ${buildConnectSources()}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
