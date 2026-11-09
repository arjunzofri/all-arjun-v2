/**
 * Fase B — Módulo 2, Slice 3: GET /api/inversion/por-codigo.
 *
 * Riesgos: auth admin-only (orden 401 → 404 → 403), flag cerrado,
 * stock negativo rompe FIFO, fuga de errores de Vida Digital,
 * partidas que no preservan null.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const state = vi.hoisted(() => ({ flag: true }));
vi.mock("@/lib/feature-flags", () => ({
  flagActivo: (key: string) => key === "inversion_mercaderia" && state.flag,
}));

vi.mock("@/lib/utils/inversion-lotes", () => ({
  getLotesCompraPorCodigo: vi.fn(),
  getStockActualPorCodigo: vi.fn(),
}));

import { auth } from "@/lib/auth";
import {
  getLotesCompraPorCodigo,
  getStockActualPorCodigo,
} from "@/lib/utils/inversion-lotes";
import { calcularInversionFifo } from "@/lib/utils/inversion-fifo";
import type { LoteCompra } from "@/lib/utils/inversion-fifo";
import {
  GET,
  componerRespuestaInversion,
} from "@/app/api/inversion/por-codigo/route";

const mockAuth = vi.mocked(auth);
const mockLotes = vi.mocked(getLotesCompraPorCodigo);
const mockStock = vi.mocked(getStockActualPorCodigo);

const ADMIN = { user: { id: "1", role: "admin" } } as never;
const OPERADOR = { user: { id: "2", role: "operador" } } as never;

const req = (qs = "") =>
  new Request(`https://app-arjun.local/api/inversion/por-codigo${qs}`);

function sesion(s: unknown) {
  mockAuth.mockResolvedValue(s as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.flag = true;
  sesion(ADMIN);
  mockLotes.mockResolvedValue([]);
  mockStock.mockResolvedValue(0);
});

// ── Auth y flag ──────────────────────────────────────────────────────────

describe("orden de controles", () => {
  it("sin sesión → 401 (aunque el flag esté apagado)", async () => {
    sesion(null);
    state.flag = false;

    const res = await GET(req("?codigo=1055"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No autorizado" });
  });

  it("flag apagado con admin → 404", async () => {
    state.flag = false;

    const res = await GET(req("?codigo=1055"));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No encontrado" });
    expect(mockLotes).not.toHaveBeenCalled();
    expect(mockStock).not.toHaveBeenCalled();
  });

  it("flag apagado con operador → 404 (el flag se evalúa antes del rol)", async () => {
    sesion(OPERADOR);
    state.flag = false;

    const res = await GET(req("?codigo=1055"));

    expect(res.status).toBe(404);
  });

  it("operador con flag activo → 403 Prohibido", async () => {
    sesion(OPERADOR);

    const res = await GET(req("?codigo=1055"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Prohibido" });
    expect(mockLotes).not.toHaveBeenCalled();
    expect(mockStock).not.toHaveBeenCalled();
  });
});

// ── Validación de codigo ─────────────────────────────────────────────────

describe("parámetro codigo", () => {
  it("ausente → 400", async () => {
    const res = await GET(req());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Parámetro codigo requerido" });
  });

  it("vacío → 400", async () => {
    const res = await GET(req("?codigo="));
    expect(res.status).toBe(400);
  });

  it("más de 30 caracteres → 400", async () => {
    const res = await GET(req(`?codigo=${"x".repeat(31)}`));
    expect(res.status).toBe(400);
  });

  it("hace trim antes de consultar", async () => {
    const res = await GET(req("?codigo=%201055%20"));

    expect(res.status).toBe(200);
    expect(mockLotes).toHaveBeenCalledWith("1055");
    expect(mockStock).toHaveBeenCalledWith("1055");
  });
});

// ── Errores de origen ────────────────────────────────────────────────────

describe("errores de consulta", () => {
  it("falla Vida Digital → 502 sin filtrar el mensaje original", async () => {
    mockLotes.mockRejectedValue(
      new Error("relation vida.itemdcto does not exist")
    );

    const res = await GET(req("?codigo=1055"));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ error: "No se pudo consultar Vida Digital" });
    expect(JSON.stringify(body)).not.toContain("itemdcto");
  });

  it("falla la DB propia (stock) → 500 sin filtrar el mensaje original", async () => {
    mockStock.mockRejectedValue(new Error("password authentication failed"));

    const res = await GET(req("?codigo=1055"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Error interno" });
    expect(JSON.stringify(body)).not.toContain("password");
  });
});

// ── Composición ──────────────────────────────────────────────────────────

describe("stock negativo", () => {
  it("clampea a 0, conserva stockRegistrado y advierte", async () => {
    const lotes: LoteCompra[] = [
      { folio: "MAN-1", fecha: null, cantidad: 10, costoUnitario: null },
    ];
    mockLotes.mockResolvedValue(lotes);
    mockStock.mockResolvedValue(-7);

    const res = await GET(req("?codigo=NEG-001"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stockActual).toBe(0);
    expect(body.stockRegistrado).toBe(-7);
    expect(body.advertencia).toBe("stock_negativo");
    expect(body.valorTotal).toBe(0);
    expect(body.cantidadSinCosto).toBe(0);
    expect(body.partidas).toEqual([
      {
        folio: "MAN-1",
        fecha: null,
        cantidadComprada: 10,
        cantidadRemanente: 0,
        costoUnitario: null,
        valor: null,
      },
    ]);
  });
});

describe("happy path", () => {
  const lotes: LoteCompra[] = [
    { folio: "001653", fecha: "2026-05-19", cantidad: 450, costoUnitario: 2 },
    { folio: "002418", fecha: "2025-02-19", cantidad: 60, costoUnitario: 2 },
    { folio: "001710", fecha: "2024-10-28", cantidad: 390, costoUnitario: 2 },
  ];

  it("devuelve exactamente la composición pura y el total de FIFO", async () => {
    mockLotes.mockResolvedValue(lotes);
    mockStock.mockResolvedValue(466);

    const res = await GET(req("?codigo=1055"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(componerRespuestaInversion("1055", lotes, 466));
    expect(body.advertencia).toBeNull();
    expect(body.valorTotal).toBe(calcularInversionFifo(lotes, 466).valorTotal);
    expect(body.partidas.map((p: { folio: string }) => p.folio)).toEqual([
      "001653",
      "002418",
      "001710",
    ]);
  });

  it("código inexistente → 200 con ceros", async () => {
    const res = await GET(req("?codigo=NO-EXISTE"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      codigo: "NO-EXISTE",
      stockActual: 0,
      stockRegistrado: 0,
      advertencia: null,
      valorTotal: 0,
      cantidadTotalCompras: 0,
      cantidadValorizada: 0,
      cantidadSinCosto: 0,
      partidas: [],
    });
  });
});

describe("componerRespuestaInversion() — pura", () => {
  it("preserva null en fecha, costo y valor; no consulta nada", () => {
    const lotes: LoteCompra[] = [
      { folio: "SIN-FECHA", fecha: null, cantidad: 5, costoUnitario: null },
    ];

    const r = componerRespuestaInversion("X", lotes, 5);

    expect(r.partidas).toEqual([
      {
        folio: "SIN-FECHA",
        fecha: null,
        cantidadComprada: 5,
        cantidadRemanente: 5,
        costoUnitario: null,
        valor: null,
      },
    ]);
    expect(r.stockActual).toBe(5);
    expect(r.stockRegistrado).toBe(5);
    expect(r.advertencia).toBeNull();
    expect(mockLotes).not.toHaveBeenCalled();
    expect(mockStock).not.toHaveBeenCalled();
  });
});
