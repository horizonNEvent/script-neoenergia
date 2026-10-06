import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Túnel Cloudflare (quick tunnel) para acesso remoto ao `next dev`
  allowedDevOrigins: ['*.trycloudflare.com'],
};

export default nextConfig;
