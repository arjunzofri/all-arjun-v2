/**
 * Fase B — Backfill de movimiento_visaciones.
 *
 * Sin conexión real: @neondatabase/serverless y getComprasAnilDesde están
 * mockeados. Los movimientos huérfanos se simulan en memoria.
 *
 * Riesgos:
 *  T1. getComprasAnilDesde lanza → no inserta nada, propaga error
 *  T2. (folio, codigo) sin match en Vida Digital → sinMatch=1, no aborta
 *  T3. Doble ejecución → segunda corrida 0 filas, sin duplicados
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

vi.mock("@/db/vidadigital/queries", () => ({
  getComprasAnilDesde: vi.fn(),
}));

import { backfillVisaciones } from "@/lib/sync/backfill-visaciones";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";

const mockGet = getComprasAnilDesde as ReturnType<typeof vi.fn>;

type Huerfano = { id: number; folio: string; codigo: string };

let huerfanos: Huerfano[] = [];
// Simula la unique (movimiento_id, nro_ingreso): la segunda inserción vuelve vacía.
const insertados = new Set<string>();

function compra(folio: string, codigo: string) {
  return {
    folio,
    codigo,
    fechanvt: "2026-05-19",
    detalle: "Test",
    cantidad: 5,
    cantcaja: 1,
    imagenUrl: null,
    bodega: "Bodega 1 Vida Digital",
    visaciones: [{ nroIngreso: `NRO-${folio}`, cantidad: 5 }],
  };
}

beforeEach(() => {
  huerfanos = [];
  insertados.clear();
  mockGet.mockReset();
  mockSql.mockReset();
  mockSql.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join("?");
    if (text.includes("FROM movimientos m")) return huerfanos;
    if (text.includes("INSERT INTO movimiento_visaciones")) {
      const key = `${values[0]}|${values[1]}`;
      if (insertados.has(key)) return [];
      insertados.add(key);
      return [{ id: insertados.size }];
    }
    return [];
  });
});

describe("backfillVisaciones", () => {
  it("T1: getComprasAnilDesde lanza → no inserta nada, propaga error", async () => {
    mockGet.mockRejectedValue(new Error("Vida Digital caída"));

    await expect(backfillVisaciones()).rejects.toThrow("Vida Digital caída");
    expect(mockSql).not.toHaveBeenCalled();
  });

  it("T2: (folio, codigo) sin match → sinMatch=1, no aborta", async () => {
    huerfanos = [
      { id: 1, folio: "BF-A", codigo: "COD-A" },
      { id: 2, folio: "BF-B", codigo: "COD-B" },
    ];
    mockGet.mockResolvedValue([compra("BF-A", "COD-A")]);

    const result = await backfillVisaciones();

    expect(result).toEqual({ procesados: 1, sinMatch: 1, filasInsertadas: 1 });
  });

  it("T3: doble ejecución → segunda corrida 0 filas, sin duplicados", async () => {
    huerfanos = [{ id: 1, folio: "BF-A", codigo: "COD-A" }];
    mockGet.mockResolvedValue([compra("BF-A", "COD-A")]);

    const r1 = await backfillVisaciones();
    expect(r1.filasInsertadas).toBe(1);

    const r2 = await backfillVisaciones();
    expect(r2.filasInsertadas).toBe(0);

    const insert = mockSql.mock.calls
      .map(([s]) => (s as TemplateStringsArray).join("?"))
      .find((t) => t.includes("INSERT INTO movimiento_visaciones"));
    expect(insert).toContain("ON CONFLICT (movimiento_id, nro_ingreso) DO NOTHING");
  });
});
