/**
 * Fase B — Conciliación de compras Anil, sub-slice 1B.
 * IO de la app + estado en VD. Sin conexión real:
 * neon, getVidaDigitalClient, getComprasAnilDesde están mockeados.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSql, mockVdExecute } = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockVdExecute: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

vi.mock("@/db/vidadigital", () => ({
  getVidaDigitalClient: vi.fn(() => ({ execute: mockVdExecute })),
}));

vi.mock("@/db/vidadigital/queries", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/db/vidadigital/queries")>();
  return {
    ...actual,
    getComprasAnilDesde: vi.fn(),
    getEstadoNotasVd: vi.fn(actual.getEstadoNotasVd),
  };
});

import {
  getLineasApp,
  conciliarComprasAnil,
  acotarLineasApp,
} from "@/lib/sync/conciliacion-compras";
import {
  getComprasAnilDesde,
  getEstadoNotasVd,
} from "@/db/vidadigital/queries";

const mockGetCompras = getComprasAnilDesde as ReturnType<typeof vi.fn>;
const mockGetEstado = getEstadoNotasVd as ReturnType<typeof vi.fn>;

type SqlCall = [TemplateStringsArray, ...unknown[]];
const calls = () => mockSql.mock.calls as unknown as SqlCall[];
const textos = () => calls().map(([s]) => s.join("?"));

function filaApp(
  folio: string,
  codigo: string,
  cantidad: number | string,
  creadoDesde = "2026-07-01",
) {
  return {
    folio,
    codigo,
    bodega: "Bodega 1 Vida Digital",
    cantidad,
    creadoDesde,
  };
}

function compraVd(folio: string, codigo: string, cantidad: number) {
  return {
    folio,
    fechanvt: null,
    fechconf: "2026-08-05",
    codigo,
    detalle: null,
    cantidad,
    cantcaja: null,
    imagenUrl: null,
    bodega: "Bodega 1 Vida Digital",
    visaciones: [],
    precioUnitario: null,
  };
}

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockResolvedValue([]);
  mockVdExecute.mockReset();
  mockVdExecute.mockResolvedValue({ rows: [] });
  mockGetCompras.mockReset();
  mockGetEstado.mockClear();
});

// ── 13: una sola query, patrón esperado ─────────────────────────────────
describe("getLineasApp()", () => {
  it("emite una sola query con entrada + folio numérico + ajustes pre-agregados", async () => {
    await getLineasApp();

    expect(mockSql).toHaveBeenCalledTimes(1);
    const texto = textos()[0];
    expect(texto).toContain("tipo = 'entrada'");
    expect(texto).toContain("folio ~");
    expect(texto).toContain("LEFT JOIN");
    expect(texto).toContain("movimiento_original_id");
    expect(texto).toContain("SUM(cantidad)");
    // bug 203 diferencias falsas: la ventana necesita MIN(created_at)
    expect(texto).toContain("MIN(m.created_at)");
  });

  // ── 14: neto app = entrada + ajuste ───────────────────────────────────
  it("suma ajustes al neto (la query resta/ajusta server-side)", async () => {
    mockSql.mockResolvedValue([filaApp("001986", "HR-6", 800, "2026-06-02")]);
    const lineas = await getLineasApp();
    expect(lineas).toEqual([
      {
        folio: "001986",
        codigo: "HR-6",
        bodega: "Bodega 1 Vida Digital",
        cantidad: 800,
        creadoDesde: "2026-06-02",
      },
    ]);
    const texto = textos()[0];
    expect(texto).toContain("SUM(m.cantidad) + COALESCE(SUM(adj.cantidad), 0)");
  });

  // ── 15: SUM como string → Number ─────────────────────────────────────
  it("convierte cantidad string a number", async () => {
    mockSql.mockResolvedValue([filaApp("001987", "S-266", "300")]);
    const [linea] = await getLineasApp();
    expect(linea.cantidad).toBe(300);
    expect(typeof linea.cantidad).toBe("number");
  });
});

// ── 16-17: conciliarComprasAnil consulta VD solo para folios ausentes ──
describe("conciliarComprasAnil()", () => {
  it("no llama getEstadoNotasVd si no hay folios app-only", async () => {
    mockGetCompras.mockResolvedValue([compraVd("001", "A", 1)]);
    mockSql.mockResolvedValue([filaApp("001", "A", 1)]);

    await conciliarComprasAnil("2026-06-15");

    expect(mockGetEstado).not.toHaveBeenCalled();
  });

  it("llama getEstadoNotasVd solo con los folios ausentes en VD", async () => {
    mockGetCompras.mockResolvedValue([compraVd("001", "A", 1)]);
    mockSql.mockResolvedValue([
      filaApp("001", "A", 1),
      filaApp("002", "B", 2),
      filaApp("002", "C", 3),
    ]);

    await conciliarComprasAnil("2026-06-15");

    expect(mockGetEstado).toHaveBeenCalledTimes(1);
    expect(mockGetEstado).toHaveBeenCalledWith(["002"]);
  });

  // ── 19: clasificación integrada ──────────────────────────────────────
  it("estado con fechconf NULL → motivo sin_fechconf", async () => {
    mockGetCompras.mockResolvedValue([]);
    mockSql.mockResolvedValue([filaApp("002", "B", 2)]);
    mockGetEstado.mockResolvedValueOnce([
      {
        folio: "002",
        existe: true,
        fechconf: null,
        lineasConfirmadas: 6,
        lineasValidas: 0,
      },
    ]);

    const res = await conciliarComprasAnil("2026-06-15");
    const ausente = res.diferencias.find(
      (d) => d.tipo === "nota_ausente_en_vd",
    );
    expect(ausente?.motivo).toBe("sin_fechconf");
  });
});

// ── bug "203 diferencias falsas": ventana de la app ─────────────────────
describe("conciliarComprasAnil() ventana de la app", () => {
  it("(a) línea app anterior a desde y fuera de VD no cuenta como diferencia", async () => {
    mockGetCompras.mockResolvedValue([compraVd("002515", "A", 10)]);
    mockSql.mockResolvedValue([
      filaApp("002515", "A", 10, "2026-11-10"),
      filaApp("001653", "B", 5, "2026-06-23"),
    ]);

    const res = await conciliarComprasAnil("2026-11-10");

    expect(res.cuadra).toBe(true);
    expect(res.diferencias).toEqual([]);
  });

  it("(b) nota anulada creada desde desde sigue como sobra + ausente", async () => {
    mockGetCompras.mockResolvedValue([]);
    mockSql.mockResolvedValue([filaApp("003000", "A", 4, "2026-11-10")]);
    mockGetEstado.mockResolvedValueOnce([
      {
        folio: "003000",
        existe: true,
        fechconf: null,
        lineasConfirmadas: 0,
        lineasValidas: 0,
      },
    ]);

    const res = await conciliarComprasAnil("2026-11-10");

    expect(res.diferencias.map((d) => d.tipo).sort()).toEqual([
      "nota_ausente_en_vd",
      "sobra_en_app",
    ]);
  });

  it("(c) línea app anterior a desde con folio presente en VD se compara", async () => {
    mockGetCompras.mockResolvedValue([compraVd("001", "A", 7)]);
    mockSql.mockResolvedValue([filaApp("001", "A", 5, "2026-01-01")]);

    const res = await conciliarComprasAnil("2026-11-10");

    expect(res.diferencias).toHaveLength(1);
    expect(res.diferencias[0].tipo).toBe("cantidad_distinta");
  });

  it("acotarLineasApp conserva por folio VD o por fecha de creación", () => {
    const lineas = [
      {
        folio: "001",
        codigo: "A",
        bodega: "B",
        cantidad: 1,
        creadoDesde: "2026-01-01",
      },
      {
        folio: "002",
        codigo: "B",
        bodega: "B",
        cantidad: 2,
        creadoDesde: "2026-11-15",
      },
      {
        folio: "003",
        codigo: "C",
        bodega: "B",
        cantidad: 3,
        creadoDesde: "2026-01-01",
      },
    ];

    const acotadas = acotarLineasApp(lineas, new Set(["001"]), "2026-11-10");

    expect(acotadas.map((l) => l.folio)).toEqual(["001", "002"]);
  });
});

// ── 18: folios vacíos → [] sin consultar ───────────────────────────────
describe("getEstadoNotasVd()", () => {
  it("devuelve [] sin consultar si no hay folios", async () => {
    const res = await getEstadoNotasVd([]);
    expect(res).toEqual([]);
    expect(mockVdExecute).not.toHaveBeenCalled();
  });
});
