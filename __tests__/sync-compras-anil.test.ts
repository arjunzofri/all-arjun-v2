/**
 * Fase B — Slice 03: tests del sync de compras Anil.
 *
 * Sin conexión real: @neondatabase/serverless y getComprasAnilDesde están
 * mockeados. Ningún test escribe en la base de producción.
 *
 * Riesgos: R1 doble sync duplica, R2 watermark no avanza,
 * R3 sin sesión, R5 bodega desconocida.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Mocks al nivel superior (hoisted) ────────────────────────────────────
const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/db/vidadigital/queries", () => ({
  getComprasAnilDesde: vi.fn(),
}));

import { syncComprasAnil, insertarMovimientoSync } from "@/lib/sync/compras-anil";
import { POST } from "@/app/api/sync/compras-anil/route";
import { auth } from "@/lib/auth";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";

const mockGet = getComprasAnilDesde as ReturnType<typeof vi.fn>;
const mockAuth = auth as ReturnType<typeof vi.fn>;

type SqlCall = [TemplateStringsArray, ...unknown[]];

const calls = () => mockSql.mock.calls as unknown as SqlCall[];
const texts = () => calls().map(([s]) => s.join("?"));

// Filas que syncComprasAnil valida contra BODEGA_ID.
const BODEGAS = [
  { id: 1, nombre: "Bodega 1 Vida Digital" },
  { id: 2, nombre: "Bodega 2 Vida Digital" },
  { id: 3, nombre: "Bodega Arjun" },
];

function compra(over: Record<string, unknown> = {}) {
  return {
    folio: "F-1",
    fechanvt: "2026-07-01",
    codigo: "COD-1",
    detalle: null,
    cantidad: 1,
    cantcaja: 1,
    imagenUrl: null,
    bodega: "Bodega 1 Vida Digital",
    visaciones: [] as { nroIngreso: string; cantidad: number }[],
    ...over,
  };
}

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    if (text.includes("FROM bodegas")) return BODEGAS;
    return [];
  });
  mockGet.mockReset();
  mockAuth.mockReset();
});

// ── R1: Idempotencia — doble sync no duplica ────────────────────────────
describe("R1 — idempotencia", () => {
  it("el schema declara unique(folio, producto_id) en movimientos", () => {
    const schema = readFileSync(join(process.cwd(), "db", "schema.ts"), "utf8");
    expect(schema).toContain('unique("uq_movimientos_folio_producto").on(t.folio, t.productoId)');
  });

  it("la CTE de inserción lleva el guard NOT EXISTS por (folio, producto)", async () => {
    await insertarMovimientoSync(mockSql as never, {
      folio: "F-1",
      codigo: "COD-1",
      cantidad: 2,
      bodegaId: 1,
      visaciones: [],
      fechanvt: "2026-07-01",
    });

    const principal = texts().find((t) => t.includes("INSERT INTO movimientos"));
    expect(principal).toBeDefined();
    expect(principal).toContain("WITH existing AS");
    expect(principal).toContain("folio = ?");
    expect(principal).toContain("producto_id = (SELECT id FROM productos WHERE codigo = ?");
    expect(principal).toContain("NOT EXISTS (SELECT 1 FROM existing)");
  });
});

// ── R2: Watermark ──────────────────────────────────────────────────────
describe("R2 — watermark", () => {
  it("escribe como watermark la mayor fechanvt procesada", async () => {
    mockGet.mockResolvedValue([
      compra({ folio: "F-A", codigo: "A", fechanvt: "2026-07-01" }),
      compra({ folio: "F-B", codigo: "B", fechanvt: "2026-08-03" }),
    ]);

    const res = await syncComprasAnil("2026-06-18");

    expect(res.watermark).toBe("2026-08-03");

    const ultimo = calls()[calls().length - 1];
    const text = ultimo[0].join("?");
    expect(text).toContain("INSERT INTO sync_watermark");
    expect(ultimo.slice(1)).toContain("compras-anil");
    expect(ultimo.slice(1)).toContain("2026-08-03");
  });
});

// ── R3: Auth via NextAuth session ────────────────────────────────────────
describe("R3 — seguridad del endpoint", () => {
  it("devuelve 401 sin sesión", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
  });
});

// ── R5: Bodega desconocida ──────────────────────────────────────────────
describe("R5 — bodega desconocida", () => {
  it("omite la compra sin código GLP/GL1/GL2 y no lanza", async () => {
    mockGet.mockResolvedValue([
      compra({ folio: "F-X", codigo: "X", bodega: "Bodega Fantasma" }),
    ]);

    const res = await syncComprasAnil("2026-06-18");

    expect(res.procesadas).toBe(0);
    const escrituras = texts().filter(
      (t) => t.includes("INSERT INTO productos") || t.includes("INSERT INTO movimientos"),
    );
    expect(escrituras).toEqual([]);
  });
});
