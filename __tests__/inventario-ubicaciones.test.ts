import { describe, expect, it } from "vitest";
import flags from "@/config/feature-flags.json";
import {
  claveUbicacion, esUbicacionValida, etiquetaUbicacion,
  opcionesUbicacion, ubicacionInventarioSchema, type UbicacionInventario,
} from "@/lib/inventario/ubicaciones";

const P1 = ["A1", "A2", "A3", "A4"] as const;
const P2 = ["IZQUIERDA", "DERECHA"] as const;
const PL = ["ARRIBA", "ABAJO"] as const;
const POS = ["F", "M", "P"] as const;
const ok = (e: unknown) => ubicacionInventarioSchema.safeParse(e).success;

const validas: UbicacionInventario[] = [
  ...P1.flatMap((pasillo) => POS.map((posicion) => ({ bodega: 1 as const, planta: "" as const, pasillo, posicion }))),
  ...PL.flatMap((planta) => P2.flatMap((pasillo) => POS.map((posicion) => ({ bodega: 2 as const, planta, pasillo, posicion })))),
];

const invalidas: unknown[] = [
  null, undefined, "1", 3, {},
  { bodega: "1", planta: "", pasillo: "A1", posicion: "F" },
  { bodega: 3, planta: "", pasillo: "A1", posicion: "F" },
  { bodega: 1, planta: "", pasillo: "A5", posicion: "F" },
  { bodega: 1, planta: null, pasillo: "A1", posicion: "F" },
  { bodega: 1, planta: "ARRIBA", pasillo: "A1", posicion: "F" },
  { bodega: 1, planta: "", pasillo: "IZQUIERDA", posicion: "F" },
  { bodega: 2, planta: "", pasillo: "DERECHA", posicion: "F" },
  { bodega: 2, planta: "ARRIBA", pasillo: "A1", posicion: "F" },
  { bodega: 1, planta: "", pasillo: "A1", posicion: "X" },
  { bodega: 1, planta: "", pasillo: "A1" },
  { bodega: 1, planta: "", pasillo: "A1", posicion: "F", extra: true },
];

describe("contrato de ubicaciones de inventario", () => {
  it("enumera 24 combinaciones válidas y únicas", () => {
    expect(validas).toHaveLength(24);
    for (const u of validas) expect(ok(u)).toBe(true);
    expect(new Set(validas.map(claveUbicacion)).size).toBe(24);
  });
  it("rechaza entradas inválidas en schema y runtime", () => {
    for (const entrada of invalidas) {
      expect(ok(entrada)).toBe(false);
      expect(esUbicacionValida(entrada)).toBe(false);
    }
  });
  it("acepta una ubicación válida en runtime", () => {
    expect(esUbicacionValida(validas[0])).toBe(true);
  });
  it("genera etiquetas y claves exactas", () => {
    expect(etiquetaUbicacion({ bodega: 1, planta: "", pasillo: "A2", posicion: "F" })).toBe("B1 · A2 · Fondo");
    expect(etiquetaUbicacion({ bodega: 2, planta: "ARRIBA", pasillo: "DERECHA", posicion: "M" })).toBe("B2 · Arriba · Derecha · Medio");
    expect(claveUbicacion({ bodega: 1, planta: "", pasillo: "A2", posicion: "F" })).toBe("1||A2|F");
    expect(claveUbicacion({ bodega: 2, planta: "ARRIBA", pasillo: "DERECHA", posicion: "M" })).toBe("2|ARRIBA|DERECHA|M");
  });
  it("expone opciones dependientes sin defaults", () => {
    expect(opcionesUbicacion(1).plantas.map((o) => o.codigo)).toEqual([""]);
    expect(opcionesUbicacion(1).pasillos.map((o) => o.codigo)).toEqual(["A1", "A2", "A3", "A4"]);
    expect(opcionesUbicacion(1).posiciones.map((o) => o.etiqueta)).toEqual(["Fondo", "Medio", "Principal"]);
    expect(opcionesUbicacion(2).plantas).toEqual([{ codigo: "ARRIBA", etiqueta: "Arriba" }, { codigo: "ABAJO", etiqueta: "Abajo" }]);
    expect(opcionesUbicacion(2).pasillos.map((o) => o.codigo)).toEqual(["IZQUIERDA", "DERECHA"]);
  });
  it("mantiene los flags nuevos apagados", () => {
    expect(flags.inventario_bodega).toBe(false);
    expect(flags.asignacion_bodega_compra).toBe(false);
  });
});
