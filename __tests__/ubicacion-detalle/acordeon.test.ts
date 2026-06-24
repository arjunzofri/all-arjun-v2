import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ── Logica pura exportable ────────────────────────────────────────────

type Entrada = { id: number; folio: string | null; fecha: string | null; cantidad: number; precioUnitario: number | null };
type Salida  = { id: number; fecha: string; cantidad: number; destino: string | null; usuario: string };
type Movimientos = { entradas: Entrada[]; salidas: Salida[] };

export function totalEntradas(mov: Movimientos): number {
  return mov.entradas.reduce((s, e) => s + e.cantidad, 0);
}

export function totalSalidas(mov: Movimientos): number {
  return mov.salidas.reduce((s, e) => s + e.cantidad, 0);
}

export function formatFecha(iso: string | null): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("es-CL", { dateStyle: "short" });
}

describe("totalEntradas", () => {
  it("suma cantidades de entradas", () => {
    const mov: Movimientos = {
      entradas: [
        { id: 1, folio: "001653", fecha: "2026-05-19", cantidad: 60, precioUnitario: 106 },
        { id: 2, folio: "001200", fecha: "2026-01-10", cantidad: 40, precioUnitario: 98 },
      ],
      salidas: [],
    };
    expect(totalEntradas(mov)).toBe(100);
  });

  it("retorna 0 si no hay entradas", () => {
    expect(totalEntradas({ entradas: [], salidas: [] })).toBe(0);
  });
});

describe("totalSalidas", () => {
  it("suma cantidades de salidas", () => {
    const mov: Movimientos = {
      entradas: [],
      salidas: [
        { id: 1, fecha: "2026-05-30", cantidad: 3, destino: "Modulo 182", usuario: "johander" },
        { id: 2, fecha: "2026-06-06", cantidad: 1, destino: "Modulo 182", usuario: "danitza" },
      ],
    };
    expect(totalSalidas(mov)).toBe(4);
  });
});

describe("formatFecha", () => {
  it("formatea fecha ISO a formato corto", () => {
    const result = formatFecha("2026-05-19T00:00:00.000Z");
    expect(result).toMatch(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/);
  });

  it("retorna --- para null", () => {
    expect(formatFecha(null)).toBe("---");
  });
});

// ── Contrato de la action ─────────────────────────────────────────────

describe("vistas.ts — getMovimientosPorProductoUbicacion", () => {
  it("la funcion existe en vistas.ts", () => {
    const src = readFileSync(join(process.cwd(), "lib", "actions", "vistas.ts"), "utf-8");
    expect(src).toContain("getMovimientosPorProductoUbicacion");
  });

  it("recibe productoId, tipo y ubicacionId", () => {
    const src = readFileSync(join(process.cwd(), "lib", "actions", "vistas.ts"), "utf-8");
    const fn = src.substring(src.indexOf("getMovimientosPorProductoUbicacion"), src.indexOf("getMovimientosPorProductoUbicacion") + 300);
    expect(fn).toContain("productoId");
    expect(fn).toContain("tipo");
    expect(fn).toContain("ubicacionId");
  });

  it("devuelve entradas y salidas", () => {
    const src2 = readFileSync(join(process.cwd(), "lib", "actions", "vistas.ts"), "utf-8");
    const start = src2.indexOf("getMovimientosPorProductoUbicacion");
    const block = src2.substring(start);
    expect(block).toContain("entradas");
    expect(block).toContain("salidas");
  });
});

// ── Contrato del componente ───────────────────────────────────────────

describe("UbicacionDetalle.tsx — acordeon expandible", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "(dashboard)", "components", "UbicacionDetalle.tsx"),
    "utf-8"
  );

  it("importa getMovimientosPorProductoUbicacion", () => {
    expect(src).toContain("getMovimientosPorProductoUbicacion");
  });

  it("tiene estado para fila expandida", () => {
    expect(src).toMatch(/expanded|expandido/i);
  });

  it("tiene estado de loading por fila (Map o similar)", () => {
    expect(src).toMatch(/loadingMov|movLoading|loadingDetalle/i);
  });

  it("renderiza sub-filas de entradas", () => {
    expect(src).toContain("entradas");
  });

  it("renderiza sub-filas de salidas", () => {
    expect(src).toContain("salidas");
  });
});