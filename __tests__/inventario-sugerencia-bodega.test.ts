// Fase B — inv-23. ROJO: lib/inventario/sugerencia-bodega no existe aún.
import { expect, it } from "vitest";
import { bodegaActivaDe, resolverSugerenciaBodega } from "@/lib/inventario/sugerencia-bodega";

const B = [{ id: 7, nombre: "Bodega 1 Vida Digital" }, { id: 8, nombre: "Bodega 2 Vida Digital" }];
it("GLP → bodega 1 con id real 7; GL1 → bodega 2 con id real 8", () => {
  expect(resolverSugerenciaBodega("GLP", B)).toEqual({ bodega: 1, bodegaId: 7, codigoIngreso: "GLP", administrativa: false });
  expect(resolverSugerenciaBodega("GL1", B)).toEqual({ bodega: 2, bodegaId: 8, codigoIngreso: "GL1", administrativa: false });
});
it("GL2 → bodega 1 y administrativa true", () => {
  expect(resolverSugerenciaBodega("GL2", B)).toEqual({ bodega: 1, bodegaId: 7, codigoIngreso: "GL2", administrativa: true });
});
it("GLX, null, vacío o espacios → null", () => {
  for (const c of ["GLX", null, undefined, "", "   "]) expect(resolverSugerenciaBodega(c, B)).toBeNull();
});
it("nombre mapeado ausente de bodegas o lista vacía → null (nunca default)", () => {
  expect(resolverSugerenciaBodega("GLP", [{ id: 3, nombre: "Bodega Arjun" }])).toBeNull();
  expect(resolverSugerenciaBodega("GLP", [])).toBeNull();
});
it("bodegaActivaDe: sesión gana, sin sesión usa sugerencia, sin nada null", () => {
  const s = resolverSugerenciaBodega("GLP", B)!;
  expect([bodegaActivaDe(2, s), bodegaActivaDe(null, s), bodegaActivaDe(null, null)]).toEqual([2, 1, null]);
});
