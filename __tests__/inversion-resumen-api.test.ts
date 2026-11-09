/**
 * Fase B — Módulo 2, Slice 4: GET /api/inversion/resumen.
 *
 * Tests 17–24 del plan aprobado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const state = vi.hoisted(() => ({ flag: true }));
vi.mock("@/lib/feature-flags", () => ({
  flagActivo: (key: string) => key === "inversion_mercaderia" && state.flag,
}));

vi.mock("@/lib/utils/inversion-lotes", () => ({
  getStockPorCodigo: vi.fn(),
  getLotesCompraPorCodigos: vi.fn(),
}));

import { auth } from "@/lib/auth";
import {
  getStockPorCodigo,
  getLotesCompraPorCodigos,
} from "@/lib/utils/inversion-lotes";
import { calcularResumenInversion } from "@/lib/utils/inversion-resumen";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";
import type { StockCodigo } from "@/lib/utils/inversion-lotes";
import { GET } from "@/app/api/inversion/resumen/route";

const mockAuth = vi.mocked(auth);
const mockStock = vi.mocked(getStockPorCodigo);
const mockLotes = vi.mocked(getLotesCompraPorCodigos);

const ADMIN = { user: { id: "1", role: "admin" } } as never;
const OPERADOR = { user: { id: "2", role: "operador" } } as never;

const req = () => new Request("https://app-arjun.local/api/inversion/resumen");

function sesion(s: unknown) {
  mockAuth.mockResolvedValue(s as never);
}

const stock: Map<string, StockCodigo> = new Map([
  ["1055", { stock: 466, detalle: "PRODUCTO 1055" }],
  ["SIN", { stock: 12, detalle: null }],
]);

const lotes: Map<string, LoteCompra[]> = new Map([
  [
    "1055",
    [
      { folio: "001653", fecha: "2026-05-19", cantidad: 450, costoUnitario: 2 },
      { folio: "002418", fecha: "2025-02-19", cantidad: 60, costoUnitario: 2 },
      { folio: "001710", fecha: "2024-10-28", cantidad: 390, costoUnitario: 2 },
    ],
  ],
]);

beforeEach(() => {
  vi.clearAllMocks();
  state.flag = true;
  sesion(ADMIN);
  mockStock.mockResolvedValue(new Map());
  mockLotes.mockResolvedValue(new Map());
});

// ── Auth y flag ──────────────────────────────────────────────────────────

describe("orden de controles", () => {
  it("17. sin sesión → 401 aunque el flag esté apagado", async () => {
    sesion(null);
    state.flag = false;

    const res = await GET();

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No autorizado" });
  });

  it("18. flag apagado (admin y operador) → 404 sin consultar datos", async () => {
    state.flag = false;
    expect((await GET()).status).toBe(404);

    sesion(OPERADOR);
    const res = await GET();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No encontrado" });
    expect(mockStock).not.toHaveBeenCalled();
    expect(mockLotes).not.toHaveBeenCalled();
  });

  it("19. operador con flag activo → 403 sin consultar datos", async () => {
    sesion(OPERADOR);

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Prohibido" });
    expect(mockStock).not.toHaveBeenCalled();
    expect(mockLotes).not.toHaveBeenCalled();
  });
});

// ── Happy path ───────────────────────────────────────────────────────────

describe("respuesta", () => {
  it("20. devuelve exactamente calcularResumenInversion(...)", async () => {
    mockStock.mockResolvedValue(stock);
    mockLotes.mockResolvedValue(lotes);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(calcularResumenInversion(stock, lotes));
  });

  it("21. sin códigos con stock → 200 con ceros", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
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

  it("24. una llamada a stock y una al batch (2 queries VD + 1 stock = 3)", async () => {
    mockStock.mockResolvedValue(stock);
    mockLotes.mockResolvedValue(lotes);

    await GET();

    expect(mockStock).toHaveBeenCalledTimes(1);
    expect(mockLotes).toHaveBeenCalledTimes(1);
    expect(mockLotes).toHaveBeenCalledWith([...stock.keys()]);
  });
});

// ── Errores de origen ────────────────────────────────────────────────────

describe("errores de consulta", () => {
  it("22. falla Vida Digital → 502 sin filtrar el mensaje original", async () => {
    mockStock.mockResolvedValue(stock);
    mockLotes.mockRejectedValue(
      new Error("relation vida.itemdcto does not exist")
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "No se pudo consultar Vida Digital" });
    expect(JSON.stringify(body)).not.toContain("itemdcto");
  });

  it("23. falla la base propia → 500 sin filtrar el mensaje original", async () => {
    mockStock.mockRejectedValue(new Error("password authentication failed"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error interno" });
    expect(JSON.stringify(body)).not.toContain("password");
    expect(mockLotes).not.toHaveBeenCalled();
  });
});
