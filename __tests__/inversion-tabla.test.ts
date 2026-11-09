/**
 * Fase B — Módulo 2, Slice 5a: proyección pura de filas para TablaInversion.
 */

import { describe, it, expect } from "vitest";
import { filasParaVista } from "@/components/inversion/TablaInversion";
import type { ResumenInversion } from "@/lib/utils/inversion-resumen";

const resumen: ResumenInversion = {
  filas: [
    {
      codigo: "1055",
      detalle: "PRODUCTO 1055",
      stock: 466,
      valorTotal: 932,
      cantidadSinCosto: 0,
      costoPromedioUnitario: 2,
    },
    {
      codigo: "SIN",
      detalle: null,
      stock: 12,
      valorTotal: 0,
      cantidadSinCosto: 12,
      costoPromedioUnitario: null,
    },
    {
      codigo: "MIXTO",
      detalle: "M",
      stock: 10,
      valorTotal: 12,
      cantidadSinCosto: 6,
      costoPromedioUnitario: 3,
    },
  ],
  totales: {
    valorTotal: 944,
    unidades: 488,
    unidadesSinCosto: 18,
    codigosConStock: 3,
    codigosSinCompras: 1,
  },
};

describe("filasParaVista()", () => {
  it("formatea cada columna y preserva el orden del resumen", () => {
    expect(filasParaVista(resumen)).toEqual([
      {
        codigo: "1055",
        detalle: "PRODUCTO 1055",
        stock: "466",
        valorTotal: "USD 932,00",
        costoPromedio: "USD 2,00",
        sinCosto: "0",
        tieneSinCosto: false,
        sinCostoTotal: false,
      },
      {
        codigo: "SIN",
        detalle: "---",
        stock: "12",
        valorTotal: "USD 0,00",
        costoPromedio: "—",
        sinCosto: "12",
        tieneSinCosto: true,
        sinCostoTotal: true,
      },
      {
        codigo: "MIXTO",
        detalle: "M",
        stock: "10",
        valorTotal: "USD 12,00",
        costoPromedio: "USD 3,00",
        sinCosto: "6",
        tieneSinCosto: true,
        sinCostoTotal: false,
      },
    ]);
  });

  it("resumen vacío → []", () => {
    expect(
      filasParaVista({
        filas: [],
        totales: {
          valorTotal: 0,
          unidades: 0,
          unidadesSinCosto: 0,
          codigosConStock: 0,
          codigosSinCompras: 0,
        },
      })
    ).toEqual([]);
  });

  it("no muta el resumen de entrada", () => {
    const antes = structuredClone(resumen);
    filasParaVista(resumen);
    expect(resumen).toEqual(antes);
  });
});
