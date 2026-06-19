/**
 * Fase B — ProductoThumbnail: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Config de sm vs lg se intercambia sin querer.
 * 2. fallbackText opcional no respeta el default por size.
 * 3. fallbackText explícito se ignora a favor del default.
 *
 * resolveThumbnailConfig() es la función pura testeable.
 *
 * AHORA EN ROJO: components/ProductoThumbnail.tsx no existe.
 */

import { describe, it, expect } from "vitest";

// ── RED: el archivo no existe ──
let resolveThumbnailConfig: any = null;
try {
  resolveThumbnailConfig = (await import("@/components/ProductoThumbnail")).resolveThumbnailConfig;
} catch {
  // Esperado en Fase B — archivo aún no creado
}

describe("resolveThumbnailConfig", () => {
  it("el componente exporta resolveThumbnailConfig", () => {
    expect(resolveThumbnailConfig).not.toBeNull();
    expect(typeof resolveThumbnailConfig).toBe("function");
  });

  // ── R1: sm sin fallbackText explícito ───────────────────────────
  it('size="sm" sin fallbackText: clases sm + fallback "—"', () => {
    const config = resolveThumbnailConfig("sm");

    expect(config.imgClass).toContain("w-8");
    expect(config.imgClass).toContain("h-8");
    expect(config.imgClass).toContain("shrink-0");
    expect(config.fallbackClass).toContain("text-xs");
    expect(config.fallbackText).toBe("—");
  });

  // ── R2: lg sin fallbackText explícito ──────────────────────────
  it('size="lg" sin fallbackText: clases lg + fallback "Sin imagen"', () => {
    const config = resolveThumbnailConfig("lg");

    expect(config.imgClass).toContain("w-24");
    expect(config.imgClass).toContain("h-24");
    expect(config.imgClass).not.toContain("shrink-0");
    expect(config.fallbackClass).toContain("text-sm");
    expect(config.fallbackText).toBe("Sin imagen");
  });

  // ── R3: fallbackText explícito sobreescribe el default ─────────
  it("fallbackText explicito prevalece sobre el default del size", () => {
    const sm = resolveThumbnailConfig("sm", "Custom sm");
    const lg = resolveThumbnailConfig("lg", "Custom lg");

    expect(sm.fallbackText).toBe("Custom sm");
    expect(lg.fallbackText).toBe("Custom lg");
    // demás props sin cambios
    expect(sm.imgClass).toContain("w-8");
  });
});
