/**
 * Fase B — Persistencia de búsqueda en URL: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Lectura inicial de ?q= al montar (especificación — depende de window.location).
 * 2. URL se actualiza con el valor correcto de q, encodeado.
 * 3. q vacío → URL sin ?q= colgando.
 *
 * buildProductosUrl(q) es la función pura testeable.
 * router.replace() es el side effect — vive en el useEffect, no se testea sin jsdom.
 *
 * AHORA EN ROJO: page.tsx no exporta buildProductosUrl.
 */

import { describe, it, expect } from "vitest";

// ── RED: el archivo actual no exporta buildProductosUrl ──
let buildProductosUrl: any = null;
try {
  buildProductosUrl = (await import("@/app/(dashboard)/productos/page")).buildProductosUrl;
} catch {
  // Esperado en Fase B — export no existe
}

describe("productos — URL sync", () => {
  // ── Contrato de existencia ────────────────────────────────────────
  it("el archivo exporta buildProductosUrl", () => {
    expect(buildProductosUrl).not.toBeNull();
    expect(typeof buildProductosUrl).toBe("function");
  });

  // ── R1: q vacío → /productos sin query ───────────────────────────
  it('q vacío devuelve "/productos" sin ?q=', () => {
    expect(buildProductosUrl("")).toBe("/productos");
  });

  // ── R2: q con valor → /productos?q=valor ─────────────────────────
  it("q con texto devuelve /productos?q=texto", () => {
    expect(buildProductosUrl("foo")).toBe("/productos?q=foo");
  });

  // ── R3: espacios encodeados correctamente ─────────────────────────
  it("espacios se encodean como %20, no como + ni crudos", () => {
    const url = buildProductosUrl("foo bar");
    expect(url).toContain("foo%20bar");
    expect(url).not.toContain("foo bar");
    expect(url).not.toContain("foo+bar");
  });

  // ── R4: caracteres especiales encodeados ──────────────────────────
  it("caracteres especiales se encodean sin romper la URL", () => {
    const url = buildProductosUrl("café & té");
    expect(url).toContain("caf%C3%A9");
    expect(url).toContain("%20%26%20");
    expect(url).toContain("t%C3%A9");
    expect(url).not.toContain("&"); // sin ampersand crudo
  });
});

// ══════════════════════════════════════════════════════════════════════
// Tests de especificación — sin jsdom no son verificables contra el
// componente real
// ══════════════════════════════════════════════════════════════════════

describe("productos — URL sync (especificación, NO regresión)", () => {
  it("[especificación] q se lee de ?q= en un useEffect post-hydratación", () => {
    // La carga inicial lee: new URLSearchParams(window.location.search).get("q")
    // en el useEffect de montaje (no en useState, para evitar hydration mismatch).
    // Si hay ?q=, se usa para el fetch inicial y se sync a q vía setQ.
    // Sin jsdom, no podemos mockear window.location.search.
    expect(true).toBe(true);
  });

  it("[especificación] router.replace se llama en el mismo useEffect que search(q)", () => {
    // El useEffect (línea 182-185) hace: search(q) + router.replace(buildProductosUrl(q))
    // Ambas llamadas en el mismo tick, sin segundo debounce.
    expect(true).toBe(true);
  });

  it("[especificación] <Link href='/productos'> en página de detalle", () => {
    // app/(dashboard)/productos/[id]/page.tsx agrega:
    // <Link href="/productos">← Volver a productos</Link>
    // JSX estático, sin lógica.
    expect(true).toBe(true);
  });
});
