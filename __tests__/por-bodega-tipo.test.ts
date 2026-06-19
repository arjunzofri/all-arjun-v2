/**
 * Regresión — endpoint por-bodega: resolveTipoUbicacion.
 *
 * Bug: el endpoint ignoraba tipo=modulo y siempre filtraba por stock.bodegaId.
 * En retornos, que pasa moduloId + tipo=modulo, devolvía productos de bodega
 * en vez de productos del módulo origen.
 *
 * Fix: resolveTipoUbicacion(tipo) → "modulo" | "bodega".
 */

import { describe, it, expect } from "vitest";
import { resolveTipoUbicacion } from "@/app/api/productos/por-bodega/route";

describe("resolveTipoUbicacion", () => {
  it('"modulo" → "modulo"', () => {
    expect(resolveTipoUbicacion("modulo")).toBe("modulo");
  });

  it('null (sin tipo) → "bodega" (default seguro)', () => {
    expect(resolveTipoUbicacion(null)).toBe("bodega");
  });

  it('"bodega" → "bodega"', () => {
    expect(resolveTipoUbicacion("bodega")).toBe("bodega");
  });

  it("cualquier otro valor → bodega (safe default)", () => {
    expect(resolveTipoUbicacion("cualquiercosa")).toBe("bodega");
  });
});
