import { describe, it, expect } from "vitest";
import {
  calcularValorizacionConteos,
  type LoteValorizacion,
  type PosicionValorizacion,
} from "@/lib/inventario/valorizacion";

const lote = (o: Partial<LoteValorizacion> & { id: number }): LoteValorizacion => ({
  folio: "F", item: null, fechaConfirmacion: "2026-06-01", cantidad: 10, precioUnitario: 1, ...o,
});
const pos = (o: Partial<PosicionValorizacion> & { id: number }): PosicionValorizacion => ({
  bodega: 1, cantidad: 10, fechaConteo: "2026-06-10", ...o,
});
const filas = (r: ReturnType<typeof calcularValorizacionConteos>) =>
  r.partidas.map((p) => [p.folio, p.cantidadSaldo, p.valor]);

describe("calcularValorizacionConteos", () => {
  it("1. E1: compra posterior al conteo excluida", () => {
    const r = calcularValorizacionConteos(
      [lote({ id: 1, folio: "F1", fechaConfirmacion: "2026-06-10", cantidad: 100, precioUnitario: 2 }),
       lote({ id: 2, folio: "F2", fechaConfirmacion: "2026-06-20", cantidad: 50, precioUnitario: 3 })],
      [pos({ id: 10, cantidad: 80, fechaConteo: "2026-06-15" })]
    );
    expect(filas(r)).toEqual([["F1", 80, 160]]);
    expect([r.stock, r.valorTotal, r.cantidadValorizada, r.cantidadSinCosto, r.incompleto, r.costoPromedio]).toEqual([80, 160, 80, 0, false, 2]);
    expect([r.fechaConteoMin, r.fechaConteoMax, r.fechasDistintas]).toEqual(["2026-06-15", "2026-06-15", false]);
  });
  it("2. E2: dos posiciones consumen cada lote una sola vez; input barajado idéntico", () => {
    const lotes = [
      lote({ id: 1, folio: "A", fechaConfirmacion: "2026-06-01", cantidad: 100, precioUnitario: 2 }),
      lote({ id: 2, folio: "B", fechaConfirmacion: "2026-06-20", cantidad: 50, precioUnitario: 3 }),
    ];
    const p1 = pos({ id: 10, cantidad: 60, fechaConteo: "2026-06-05" });
    const p2 = pos({ id: 11, cantidad: 60, fechaConteo: "2026-06-25" });
    const r = calcularValorizacionConteos(lotes, [p1, p2]);
    expect(filas(r)).toEqual([["B", 50, 150], ["A", 70, 140]]);
    expect([r.stock, r.valorTotal, r.cantidadSinCosto]).toEqual([120, 290, 0]);
    expect(calcularValorizacionConteos(lotes, [p2, p1])).toEqual(r);
  });
  it("3. compra posterior: invisible para la posición anterior, consumida por la posterior", () => {
    const lotes = [
      lote({ id: 1, folio: "A", fechaConfirmacion: "2026-06-01", cantidad: 100, precioUnitario: 2 }),
      lote({ id: 2, folio: "B", fechaConfirmacion: "2026-06-20", cantidad: 50, precioUnitario: 3 }),
    ];
    const antes = calcularValorizacionConteos(lotes, [pos({ id: 10, cantidad: 60, fechaConteo: "2026-06-05" })]);
    const despues = calcularValorizacionConteos(lotes, [pos({ id: 10, cantidad: 60, fechaConteo: "2026-06-25" })]);
    expect(filas(antes).map((f) => f[0])).toEqual(["A"]);
    expect(filas(despues)).toEqual([["B", 50, 150], ["A", 10, 20]]);
  });
  it("4. precio null: saldo asignado, valor null y unidades sin costo", () => {
    const r = calcularValorizacionConteos(
      [lote({ id: 1, folio: "A", fechaConfirmacion: "2026-06-01", cantidad: 10, precioUnitario: null }),
       lote({ id: 2, folio: "B", fechaConfirmacion: "2026-06-02", cantidad: 10, precioUnitario: 5 })],
      [pos({ id: 10, cantidad: 15 })]
    );
    expect(filas(r)).toEqual([["B", 10, 50], ["A", 5, null]]);
    expect([r.valorTotal, r.cantidadValorizada, r.cantidadSinCosto, r.incompleto, r.costoPromedio]).toEqual([50, 10, 5, true, 5]);
  });
  it("5. precio 0 es costo válido: valor 0 y no suma a sin costo", () => {
    const r = calcularValorizacionConteos([lote({ id: 1, precioUnitario: 0, cantidad: 10 })], [pos({ id: 10, cantidad: 5 })]);
    expect([r.partidas[0].valor, r.cantidadSinCosto, r.incompleto, r.costoPromedio]).toEqual([0, 0, false, 0]);
  });
  it("6. E4: lotes insuficientes dejan el faltante exacto sin costo", () => {
    const r = calcularValorizacionConteos([lote({ id: 1, cantidad: 10, precioUnitario: 2 })], [pos({ id: 10, cantidad: 15 })]);
    expect([r.stock, r.valorTotal, r.cantidadSinCosto, r.incompleto, r.costoPromedio]).toEqual([15, 20, 5, true, 2]);
  });
  it("7. rango de fechas y fechasDistintas, incluye conteo con cantidad 0", () => {
    const r = calcularValorizacionConteos(
      [],
      [pos({ id: 1, cantidad: 0, fechaConteo: "2026-06-05" }), pos({ id: 2, cantidad: 5, fechaConteo: "2026-06-25" })]
    );
    expect([r.fechaConteoMin, r.fechaConteoMax, r.fechasDistintas, r.stock]).toEqual(["2026-06-05", "2026-06-25", true, 5]);
  });
  it("8. desempate determinístico: misma fecha/folio por item DESC e id DESC", () => {
    const lotes = [
      lote({ id: 1, folio: "F", item: 2 }), lote({ id: 2, folio: "F", item: 5 }), lote({ id: 3, folio: "F", item: null }),
    ];
    const r = calcularValorizacionConteos(lotes, [pos({ id: 10, cantidad: 15 })]);
    expect(r.partidas.map((p) => [p.item, p.cantidadSaldo])).toEqual([[5, 10], [2, 5], [null, 0]]);
    expect(calcularValorizacionConteos([lotes[2], lotes[1], lotes[0]], [pos({ id: 10, cantidad: 15 })])).toEqual(r);
  });
  it("9. redondeo por partida, total y promedio a 2 decimales", () => {
    const r = calcularValorizacionConteos(
      [lote({ id: 1, folio: "A", fechaConfirmacion: "2026-03-01", cantidad: 3.5, precioUnitario: 1.2345 }),
       lote({ id: 2, folio: "B", fechaConfirmacion: "2026-05-01", cantidad: 2.25, precioUnitario: 0.1 })],
      [pos({ id: 10, cantidad: 2.75 })]
    );
    expect(filas(r)).toEqual([["B", 2.25, 0.23], ["A", 0.5, 0.62]]);
    expect([r.valorTotal, r.cantidadValorizada, r.costoPromedio]).toEqual([0.85, 2.75, 0.31]);
  });
  it("10. E6: sin posiciones no se valoriza nada", () => {
    const r = calcularValorizacionConteos([lote({ id: 1, cantidad: 10, precioUnitario: 2 })], []);
    expect(r).toEqual({
      stock: 0, valorTotal: 0, cantidadValorizada: 0, cantidadSinCosto: 0, incompleto: false,
      costoPromedio: null, fechaConteoMin: null, fechaConteoMax: null, fechasDistintas: false, partidas: [],
    });
  });
  it("11. datos negativos lanzan RangeError con folio o id en el mensaje", () => {
    expect(() => calcularValorizacionConteos([lote({ id: 1, folio: "NEG-1", cantidad: -3 })], [])).toThrow(/NEG-1/);
    expect(() => calcularValorizacionConteos([lote({ id: 2, folio: "NEG-2", precioUnitario: -0.5 })], [])).toThrow(/NEG-2/);
    expect(() => calcularValorizacionConteos([], [pos({ id: 77, cantidad: -1 })])).toThrow(RangeError);
    expect(() => calcularValorizacionConteos([], [pos({ id: 77, cantidad: -1 })])).toThrow(/77/);
  });
});
