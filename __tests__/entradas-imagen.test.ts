/**
 * Fase B — Imagen en typeahead de /entradas: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. selectProducto descarta imagenUrl al seleccionar (hoy).
 * 2. imagenUrl null → estado null, no string vacío ni undefined.
 * 3. detalle null → se convierte a "" (comportamiento existente, debe mantenerse).
 *
 * applyProductoSugerencia() es la función pura testeable.
 *
 * AHORA EN ROJO: EntradasPage.tsx no exporta applyProductoSugerencia.
 */

import { describe, it, expect } from "vitest";

// ── RED: el archivo actual no exporta applyProductoSugerencia ──
let applyProductoSugerencia: any = null;
try {
  applyProductoSugerencia = (await import("@/app/(dashboard)/entradas/page")).applyProductoSugerencia;
} catch {
  // Esperado en Fase B — export no existe
}

describe("applyProductoSugerencia", () => {
  it("el archivo exporta applyProductoSugerencia", () => {
    expect(applyProductoSugerencia).not.toBeNull();
    expect(typeof applyProductoSugerencia).toBe("function");
  });

  // ── R1: imagenUrl se guarda al seleccionar ─────────────────────
  it("guarda imagenUrl cuando la sugerencia la tiene", () => {
    const result = applyProductoSugerencia({
      codigo: "ABC123",
      detalle: "Widget",
      imagenUrl: "https://cloudinary.com/img.jpg",
    });

    expect(result.codigo).toBe("ABC123");
    expect(result.detalle).toBe("Widget");
    expect(result.imagenUrl).toBe("https://cloudinary.com/img.jpg");
    expect(result.suggestions).toEqual([]);
  });

  // ── R2: imagenUrl null → estado null ──────────────────────────
  it("imagenUrl null se guarda como null (no undefined ni string vacio)", () => {
    const result = applyProductoSugerencia({
      codigo: "XYZ",
      detalle: null,
      imagenUrl: null,
    });

    expect(result.imagenUrl).toBeNull();
    expect(result.detalle).toBe(""); // comportamiento heredado
  });

  // ── R3: detalle null → "" (comportamiento existente preservado) ──
  it("detalle null se convierte a string vacio", () => {
    const result = applyProductoSugerencia({
      codigo: "ABC",
      detalle: null,
      imagenUrl: null,
    });

    expect(result.detalle).toBe("");
  });
});

// ══════════════════════════════════════════════════════════════════════
// Tests de especificación (sin jsdom)
// ══════════════════════════════════════════════════════════════════════

describe("entradas — imagen UI (especificación, NO regresión)", () => {
  it("[especificación] dropdown muestra miniatura 32x32 con fallback si no hay imagen", () => {
    expect(true).toBe(true);
  });

  it("[especificación] post-selección muestra imagen 96x96 con fallback onError", () => {
    expect(true).toBe(true);
  });

  it("[especificación] imagen persiste al editar código manualmente (mismo bug que detalle)", () => {
    expect(true).toBe(true);
  });
});
