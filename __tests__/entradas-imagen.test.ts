/**
 * Fase B — Imagen + packing en typeahead de /entradas: Tests que intentan romper el slice.
 *
 * Riesgos cubiertos:
 *  R1. imagenUrl presente → se propaga
 *  R2. imagenUrl null → estado null (no undefined ni "")
 *  R3. detalle null → "" (comportamiento heredado)
 *  R4. packing presente → se propaga (NUEVO — antes descartado)
 *  R5. packing null → se guarda como null (NUEVO)
 *  R6. packing undefined → se normaliza a null (NUEVO)
 *
 * applyProductoSugerencia() es la función pura testeable.
 *
 * AHORA EN ROJO: EntradasPage.tsx no tiene campo packing en Sugerencia
 * ni lo propaga en applyProductoSugerencia.
 */

import { describe, it, expect } from "vitest";

// ── RED: applyProductoSugerencia existe pero no propaga packing ──
let applyProductoSugerencia: any = null;
try {
  applyProductoSugerencia = (await import("@/app/(dashboard)/entradas/page")).applyProductoSugerencia;
} catch {
  // Esperado si el export no existe (no debería pasar — ya existe de antes)
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

  // ── R4: packing presente → se propaga (RED — aún no implementado) ──
  it("guarda packing cuando la sugerencia lo tiene", () => {
    const result = applyProductoSugerencia({
      codigo: "PKG-01",
      detalle: "Caja 12 unids",
      imagenUrl: null,
      packing: 12,
    });

    expect(result.codigo).toBe("PKG-01");
    expect(result.packing).toBe(12);
  });

  // ── R5: packing null → se guarda como null (RED) ──────────────
  it("packing null se guarda como null (no undefined ni cero)", () => {
    const result = applyProductoSugerencia({
      codigo: "PKG-02",
      detalle: null,
      imagenUrl: null,
      packing: null,
    });

    expect(result.packing).toBeNull();
  });

  // ── R6: packing undefined → se normaliza a null (RED) ─────────
  it("packing ausente (undefined) se normaliza a null", () => {
    const result = applyProductoSugerencia({
      codigo: "PKG-03",
      detalle: null,
      imagenUrl: null,
    } as any);

    expect(result.packing).toBeNull();
  });
});

