import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El navegador pide /favicon.ico en páginas sin <head> de la app (ej. /manifest.json).
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon-192.png" }];
  },
};

export default nextConfig;
