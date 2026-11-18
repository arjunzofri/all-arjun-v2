/**
 * Fase B — inv-17.1: adaptador puro selección -> payload de conteo.
 * ROJO esperado: no existe lib/inventario/formulario-conteo.ts.
 */
import { describe, expect, it } from "vitest";
import { opcionesUbicacion, type UbicacionInventario } from "@/lib/inventario/ubicaciones";
import type { PosicionContada } from "@/lib/inventario/consultas";
import type { BorradorConteo } from "@/lib/inventario/borradores-conteo";
import {
  comparacion, construirUbicacion, posicionVigente, prepararConteo,
} from "@/lib/inventario/formulario-conteo";

const NONCE = "11111111-1111-4111-8111-111111111111";
const U1: UbicacionInventario = { bodega: 1, planta: "", pasillo: "A2", posicion: "P" };
const U2: UbicacionInventario = { bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA", posicion: "P" };

const combos = ([1, 2] as const).flatMap((bodega) => {
  const { plantas, pasillos, posiciones } = opcionesUbicacion(bodega);
  return plantas.flatMap((pl) => pasillos.flatMap((pa) =>
    posiciones.map((po) => ({ bodega, planta: pl.codigo, pasillo: pa.codigo, posicion: po.codigo }))));
});

const fila = (o: Partial<PosicionContada> = {}): PosicionContada => ({
  id: 9, bodega: 1, planta: "", pasillo: "A2", posicion: "P", cantidad: 5,
  usuarioId: 3, usuario: "qa-uno", creadoEn: "2026-11-01T00:00:00.000Z", ...o,
});

const borrador = (o: Partial<BorradorConteo> = {}): BorradorConteo => ({
  productoId: 7, ubicacion: U1, cantidadTexto: "12", expectedConteoId: 5,
  nonce: NONCE, actualizadoEn: 1, ...o,
});

describe("construirUbicacion", () => {
  it("recorre las 24 combinaciones del catálogo sin defaults", () => {
    expect(combos).toHaveLength(24);
    for (const c of combos) expect(construirUbicacion(c)).toEqual(c);
  });
  it("rechaza cruces, incompletas y extras sin completar nada por defecto", () => {
    const invalidos: unknown[] = [
      null, undefined, {}, "1||A2|P",
      { bodega: 1, planta: "", pasillo: "IZQUIERDA", posicion: "F" },
      { bodega: 1, planta: "ARRIBA", pasillo: "A1", posicion: "F" },
      { bodega: 2, planta: "", pasillo: "DERECHA", posicion: "F" },
      { bodega: 2, planta: "ARRIBA", pasillo: "A1", posicion: "F" },
      { bodega: 1, planta: "", pasillo: "A1" },
      { bodega: 1, planta: "", pasillo: "A1", posicion: "F", extra: true },
    ];
    for (const i of invalidos) expect(construirUbicacion(i as never)).toBeNull();
  });
});

describe("posicionVigente", () => {
  it("hace match con una fila completa real pese a sus claves extra", () => {
    const real = fila();
    expect(posicionVigente([real], U1)).toBe(real);
  });
  it("no confunde B1 con B2 similar ni devuelve fila ausente", () => {
    const deB1 = fila();
    const deB2 = fila({ id: 10, bodega: 2, planta: "ARRIBA", pasillo: "IZQUIERDA" });
    expect(posicionVigente([deB1, deB2], U2)).toBe(deB2);
    expect(posicionVigente([deB1], U2)).toBeNull();
    expect(posicionVigente([], U1)).toBeNull();
  });
  it("trata cantidad 0 como fila vigente, no como ausencia", () => {
    const cero = fila({ cantidad: 0 });
    expect(posicionVigente([cero], U1)).toBe(cero);
  });
});

describe("comparacion", () => {
  it("calcula diferencia solo con anterior y cantidad válidos", () => {
    expect(comparacion(10, "7")).toEqual({ cantidad: 7, diferencia: -3 });
    expect(comparacion(0, "0")).toEqual({ cantidad: 0, diferencia: 0 });
    expect(comparacion(null, "5")).toEqual({ cantidad: 5, diferencia: null });
  });
  it("rechaza texto inválido sin convertir vacío en 0", () => {
    for (const texto of ["", "   ", "1.5", "1,000", "-1", "1e3", "2147483648"]) {
      expect(comparacion(10, texto)).toEqual({ cantidad: null, diferencia: null });
    }
    expect(comparacion(null, "")).not.toEqual({ cantidad: 0, diferencia: 0 });
    expect(comparacion(10, "  12  ")).toEqual({ cantidad: 12, diferencia: 2 });
  });
});

describe("prepararConteo", () => {
  it("usa el expected original del draft y exactas 5 claves del action", () => {
    const payload = prepararConteo(borrador());
    expect(payload).toEqual({
      productoId: 7, ubicacion: U1, cantidad: 12, expectedConteoId: 5, idempotencyKey: NONCE,
    });
    expect(Object.keys(payload!).sort()).toEqual(
      ["cantidad", "expectedConteoId", "idempotencyKey", "productoId", "ubicacion"]);
    expect(prepararConteo.length).toBe(1);
  });
  it("refleja el texto vigente del draft y conserva expected null", () => {
    expect(prepararConteo(borrador({ cantidadTexto: "33" }))?.cantidad).toBe(33);
    expect(prepararConteo(borrador({ expectedConteoId: null }))?.expectedConteoId).toBeNull();
  });
  it("no admite expected del servidor ni cantidades paralelas coladas en el draft", () => {
    const vigenteServidor = { ...borrador(), expectedConteoId: 9, cantidad: 12 };
    expect(prepararConteo(vigenteServidor as BorradorConteo)).toBeNull();
  });
});

describe("prepararConteo con draft manipulado", () => {
  it("devuelve null sin lanzar y acepta texto 0 como cantidad 0", () => {
    const invalidos: unknown[] = [
      null, undefined, "x", {},
      { ...borrador(), productoId: 0 },
      { ...borrador(), ubicacion: { bodega: 1, planta: "", pasillo: "IZQUIERDA", posicion: "F" } },
      { ...borrador(), nonce: "no-uuid" },
      { ...borrador(), expectedConteoId: Number.MAX_SAFE_INTEGER + 1 },
      { ...borrador(), extra: true },
      { ...borrador(), cantidadTexto: "x" },
    ];
    for (const m of invalidos) {
      expect(() => prepararConteo(m as BorradorConteo)).not.toThrow();
      expect(prepararConteo(m as BorradorConteo)).toBeNull();
    }
    expect(prepararConteo(borrador({ cantidadTexto: "0" }))?.cantidad).toBe(0);
  });
});
