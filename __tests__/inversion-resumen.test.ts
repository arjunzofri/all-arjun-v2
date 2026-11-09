/**
 * Fase B — Módulo 2, Slice 4: resumen global de inversión (función pura).
 *
 * Tests 1–8 del plan aprobado.
 */

import { describe, it, expect } from "vitest";
import { calcularResumenInversion } from "@/lib/utils/inversion-resumen";
import { calcularInversionFifo } from "@/lib/utils/inversion-fifo";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";
import type { StockCodigo } from "@/lib/utils/inversion-lotes";

const s = (stock: number, detalle: string | null = null): StockCodigo => ({
  stock,
  detalle,
});

function mapaStock(entries: [string, StockCodigo][]) {
  return new Map(entries);
}

function mapaLotes(entries: [string, LoteCompra[]][]) {
  return new Map(entries);
}

describe("calcularResumenInversion() — pura", () => {
  it("1. fila idéntica a calcularInversionFifo para un código con 3 lotes", () => {
    const lotes: LoteCompra[] = [
      { folio: "001653", fecha: "2026-05-19", cantidad: 450, costoUnitario: 2 },
      { folio: "002418", fecha: "2025-02-19", cantidad: 60, costoUnitario: 2 },
      { folio: "001710", fecha: "2024-10-28", cantidad: 390, costoUnitario: 2 },
    ];
    const stock = mapaStock([["1055", s(466, "PRODUCTO 1055")]]);
    const r = calcularResumenInversion(stock, mapaLotes([["1055", lotes]]));

    const esperado = calcularInversionFifo(lotes, 466);
    expect(r.filas).toEqual([
      {
        codigo: "1055",
        detalle: "PRODUCTO 1055",
        stock: 466,
        valorTotal: esperado.valorTotal,
        cantidadSinCosto: esperado.cantidadSinCosto,
        costoPromedioUnitario: 2,
      },
    ]);
    expect(r.filas[0].valorTotal).toBe(932);
    expect(r.filas[0].cantidadSinCosto).toBe(0);
  });

  it("2. código sin lotes → todo sin costo, promedio null, cuenta en codigosSinCompras", () => {
    const r = calcularResumenInversion(
      mapaStock([["SIN-COMPRAS", s(12, null)]]),
      mapaLotes([])
    );

    expect(r.filas).toEqual([
      {
        codigo: "SIN-COMPRAS",
        detalle: null,
        stock: 12,
        valorTotal: 0,
        cantidadSinCosto: 12,
        costoPromedioUnitario: null,
      },
    ]);
    expect(r.totales.codigosSinCompras).toBe(1);
  });

  it("3. lote sin costo suma a cantidadSinCosto; promedio solo sobre valorizada", () => {
    const lotes: LoteCompra[] = [
      { folio: "MAN-1", fecha: "2026-01-01", cantidad: 6, costoUnitario: null },
      { folio: "F-2", fecha: "2025-01-01", cantidad: 20, costoUnitario: 3 },
    ];
    const r = calcularResumenInversion(
      mapaStock([["MIXTO", s(10)]]),
      mapaLotes([["MIXTO", lotes]])
    );

    // FIFO: 6 sin costo + 4 a costo 3 → valor 12, sin costo 6, promedio 3.
    expect(r.filas[0].valorTotal).toBe(12);
    expect(r.filas[0].cantidadSinCosto).toBe(6);
    expect(r.filas[0].costoPromedioUnitario).toBe(3);
  });

  it("4. orden por valorTotal desc con desempate por código asc", () => {
    const stock = mapaStock([
      ["A", s(1)],
      ["C", s(1)],
      ["B", s(1)],
    ]);
    const lotes = mapaLotes([
      ["A", [{ folio: "a", fecha: "2026-01-01", cantidad: 1, costoUnitario: 5 }]],
      ["B", [{ folio: "b", fecha: "2026-01-01", cantidad: 1, costoUnitario: 10 }]],
      ["C", [{ folio: "c", fecha: "2026-01-01", cantidad: 1, costoUnitario: 10 }]],
    ]);
    const r = calcularResumenInversion(stock, lotes);

    expect(r.filas.map((f) => f.codigo)).toEqual(["B", "C", "A"]);
  });

  it("5. totales exactos", () => {
    const stock = mapaStock([
      ["A", s(3)],
      ["B", s(4)],
      ["C", s(2)],
    ]);
    const lotes = mapaLotes([
      ["A", [{ folio: "a", fecha: "2026-01-01", cantidad: 5, costoUnitario: 2 }]],
      ["C", [{ folio: "c", fecha: "2026-01-01", cantidad: 1, costoUnitario: 10 }]],
    ]);
    const r = calcularResumenInversion(stock, lotes);

    expect(r.totales).toEqual({
      valorTotal: 16,
      unidades: 9,
      unidadesSinCosto: 5,
      codigosConStock: 3,
      codigosSinCompras: 1,
    });
  });

  it("6. stock <= 0 se descarta sin lanzar", () => {
    const stock = mapaStock([
      ["NEG", s(-5)],
      ["CERO", s(0)],
      ["OK", s(1)],
    ]);
    const r = calcularResumenInversion(stock, mapaLotes([]));

    expect(r.filas.map((f) => f.codigo)).toEqual(["OK"]);
    expect(r.totales.unidades).toBe(1);
    expect(r.totales.codigosConStock).toBe(1);
  });

  it("7. entradas vacías → filas [] y totales en cero", () => {
    const r = calcularResumenInversion(mapaStock([]), mapaLotes([]));

    expect(r).toEqual({
      filas: [],
      totales: {
        valorTotal: 0,
        unidades: 0,
        unidadesSinCosto: 0,
        codigosConStock: 0,
        codigosSinCompras: 0,
      },
    });
  });

  it("8. no muta los mapas ni los arrays de entrada", () => {
    const lotes: LoteCompra[] = [
      { folio: "a", fecha: "2026-01-01", cantidad: 5, costoUnitario: 2 },
      { folio: "b", fecha: "2025-01-01", cantidad: 5, costoUnitario: 1 },
    ];
    const stock = mapaStock([["A", s(10)]]);
    const porCodigo = mapaLotes([["A", lotes]]);
    const stockAntes = structuredClone([...stock]);
    const lotesAntes = structuredClone([...porCodigo]);

    calcularResumenInversion(stock, porCodigo);

    expect([...stock]).toEqual(stockAntes);
    expect([...porCodigo]).toEqual(lotesAntes);
    expect(lotes.map((l) => l.folio)).toEqual(["a", "b"]);
  });
});
