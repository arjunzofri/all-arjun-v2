/**
 * Fase B — Bug: /favicon.ico responde 404 (el navegador lo pide en páginas sin
 * <head> de la app). Se redirige internamente al icono PWA existente.
 */

import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config";

describe("next.config — rewrite de /favicon.ico", () => {
  it("redirige /favicon.ico a /icon-192.png", async () => {
    expect(nextConfig.rewrites).toBeTypeOf("function");
    const rewrites = await nextConfig.rewrites!();
    const lista = Array.isArray(rewrites) ? rewrites : rewrites.beforeFiles;
    expect(lista).toContainEqual({ source: "/favicon.ico", destination: "/icon-192.png" });
  });
});
