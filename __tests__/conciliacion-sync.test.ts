/**
 * Fase B — Conciliación de compras, sub-slice 1C.
 * Integración del sync: key de origen, flag, try/catch de la conciliación.
 * Sin conexión real: neon, VD, conciliacion-compras y feature-flags mockeados.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

vi.mock("@/db/vidadigital/queries", () => ({
  getComprasAnilDesde: vi.fn(),
}));

vi.mock("@/lib/sync/conciliacion-compras", () => ({
  conciliarComprasAnil: vi.fn(),
  getDesdeConciliacion: vi.fn(),
}));

vi.mock("@/lib/feature-flags", () => ({ flagActivo: vi.fn() }));

import { syncComprasAnil } from "@/lib/sync/compras-anil";
import {
  conciliarComprasAnil,
  getDesdeConciliacion,
} from "@/lib/sync/conciliacion-compras";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";
import { flagActivo } from "@/lib/feature-flags";

const mockConciliar = conciliarComprasAnil as ReturnType<typeof vi.fn>;
const mockDesde = getDesdeConciliacion as ReturnType<typeof vi.fn>;
const mockGet = getComprasAnilDesde as ReturnType<typeof vi.fn>;
const mockFlag = flagActivo as ReturnType<typeof vi.fn>;

type SqlCall = [TemplateStringsArray, ...unknown[]];
const calls = () => mockSql.mock.calls as unknown as SqlCall[];
const texts = () => calls().map(([s]) => s.join("?"));

const BODEGAS = [
  { id: 1, nombre: "Bodega 1 Vida Digital" },
  { id: 2, nombre: "Bodega 2 Vida Digital" },
  { id: 3, nombre: "Bodega Arjun" },
];

const RESULTADO = {
  desde: "2026-06-15",
  cuadra: true,
  resumen: {
    notasRevisadas: 1,
    lineasVd: 1,
    lineasApp: 1,
    unidadesVd: 10,
    unidadesApp: 10,
    diferencias: 0,
    notasConDiferencias: 0,
  },
  diferencias: [],
};

function compra(over: Record<string, unknown> = {}) {
  return {
    folio: "001986",
    fechanvt: "2026-08-05",
    fechconf: "2026-08-05",
    codigo: "HR-6",
    detalle: null,
    cantidad: 1000,
    cantcaja: 1,
    imagenUrl: null,
    bodega: "Bodega 1 Vida Digital",
    visaciones: [],
    ...over,
  };
}

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
    if (strings.join("?").includes("FROM bodegas")) return BODEGAS;
    return [];
  });
  mockGet.mockReset();
  mockGet.mockResolvedValue([compra()]);
  mockConciliar.mockReset();
  mockConciliar.mockResolvedValue(RESULTADO);
  mockDesde.mockReset();
  mockDesde.mockResolvedValue("2026-06-15");
  mockFlag.mockReset();
});

// ── 20: flag off ────────────────────────────────────────────────────────
describe("20 — flag off", () => {
  it("no llama conciliarComprasAnil y el retorno no trae conciliacion", async () => {
    mockFlag.mockReturnValue(false);

    const res = await syncComprasAnil("2026-06-01");

    expect(mockConciliar).not.toHaveBeenCalled();
    expect(res).toEqual({ procesadas: 1, watermark: "2026-08-05" });
    expect("conciliacion" in res).toBe(false);
  });
});

// ── 21: flag on ─────────────────────────────────────────────────────────
describe("21 — flag on", () => {
  it("incluye conciliacion e inserta la key de origen con ON CONFLICT DO NOTHING", async () => {
    mockFlag.mockReturnValue(true);

    const res = await syncComprasAnil("2026-06-01");

    expect(res.conciliacion).toEqual(RESULTADO);
    expect(mockDesde).toHaveBeenCalled();
    expect(mockConciliar).toHaveBeenCalledWith("2026-06-15");

    const origen = calls().find(
      ([s, ...v]) =>
        s.join("?").includes("INSERT INTO sync_watermark") &&
        v.includes("compras-anil-desde"),
    );
    expect(origen).toBeDefined();
    expect(origen![0].join("?")).toContain("ON CONFLICT (key) DO NOTHING");
    expect(origen!.slice(1)).toContain("2026-06-01"); // el corte, no maxFecha
  });
});

// ── 22: la conciliación no rompe el sync ────────────────────────────────
describe("22 — conciliación falla", () => {
  it("devuelve procesadas/watermark y conciliacion.error; watermark escrito", async () => {
    mockFlag.mockReturnValue(true);
    mockConciliar.mockRejectedValue(new Error("VD caída"));

    const res = await syncComprasAnil("2026-06-01");

    expect(res.procesadas).toBe(1);
    expect(res.watermark).toBe("2026-08-05");
    expect(res.conciliacion).toEqual({ error: "VD caída" });

    const normal = calls().find(
      ([s, ...v]) =>
        s.join("?").includes("INSERT INTO sync_watermark") &&
        v.includes("compras-anil"),
    );
    expect(normal).toBeDefined();
    expect(normal![0].join("?")).toContain("ON CONFLICT (key) DO UPDATE");
    expect(normal!.slice(1)).toContain("2026-08-05");
  });
});

// ── 23: origen antes de las inserciones y sin reemplazar al normal ──────
describe("23 — key de origen", () => {
  it("se inserta antes de los movimientos y no reemplaza al de compras-anil", async () => {
    mockFlag.mockReturnValue(false);

    await syncComprasAnil("2026-06-01");

    const idxOrigen = texts().findIndex((t) => t.includes("INSERT INTO sync_watermark"));
    const idxMovimiento = texts().findIndex(
      (t) => t.includes("INSERT INTO movimientos"),
    );
    expect(idxOrigen).toBeGreaterThanOrEqual(0);
    expect(idxMovimiento).toBeGreaterThan(idxOrigen);

    const watermarks = calls().filter(([s]) =>
      s.join("?").includes("INSERT INTO sync_watermark"),
    );
    expect(watermarks).toHaveLength(2);
    expect(watermarks[0].slice(1)).toContain("compras-anil-desde");
    expect(watermarks[1].slice(1)).toContain("compras-anil");
  });
});
