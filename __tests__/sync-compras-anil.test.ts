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

// Este test verifica el sync sin conciliación: aislado del valor real del flag.
// El caso flag-on está cubierto en conciliacion-sync.test.ts.
vi.mock("@/lib/feature-flags", () => ({
  flagActivo: vi.fn(() => false),
}));

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
    fechconf: "2026-07-01",
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
  it("el schema declara unique(folio, producto_id, bodega_origen_id) nulls not distinct", () => {
    const schema = readFileSync(join(process.cwd(), "db", "schema.ts"), "utf8");
    // compact: tolera el formato multilínea del builder de Drizzle.
    const compact = schema.replace(/\s+/g, "");
    expect(compact).toContain(
      'unique("uq_movimientos_folio_producto_bodega").on(t.folio,t.productoId,t.bodegaOrigenId).nullsNotDistinct()',
    );
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

// ── Fix 3: segunda bodega del mismo producto en la misma nota ───────────
describe("Fix 3 — bodega en la idempotencia", () => {
  // T1: mismo folio+código en dos bodegas → dos movimientos, cada uno con
  // su propio guard por bodega en la CTE.
  it("T1: dos bodegas del mismo folio/código generan dos inserts", async () => {
    await insertarMovimientoSync(mockSql as never, {
      folio: "F-1", codigo: "COD-1", cantidad: 5, bodegaId: 1,
      visaciones: [], fechanvt: "2026-07-01",
    });
    await insertarMovimientoSync(mockSql as never, {
      folio: "F-1", codigo: "COD-1", cantidad: 5, bodegaId: 2,
      visaciones: [], fechanvt: "2026-07-01",
    });

    const principales = calls().filter(([s]) =>
      s.join("?").includes("INSERT INTO movimientos"),
    );
    expect(principales).toHaveLength(2);
    for (const [strings] of principales) {
      const text = strings.join("?");
      expect(text).toContain("WITH existing AS");
      expect(text).toContain("bodega_origen_id = ?");
    }
    const valores = principales.map((c) => c.slice(1));
    expect(valores.some((v) => v.includes(1))).toBe(true);
    expect(valores.some((v) => v.includes(2))).toBe(true);
  });

  // T2: el fallback de visaciones también filtra por bodega.
  it("T2: el SELECT id de fallback filtra por bodega", async () => {
    mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      if (text.includes("FROM bodegas")) return BODEGAS;
      if (text.includes("INSERT INTO movimientos")) return []; // ya existía
      if (text.includes("SELECT id FROM movimientos")) return [{ id: 42 }];
      return [];
    });

    await insertarMovimientoSync(mockSql as never, {
      folio: "F-1", codigo: "COD-1", cantidad: 2, bodegaId: 2,
      visaciones: [{ nroIngreso: "NRO-1", cantidad: 2 }],
      fechanvt: "2026-07-01",
    });

    const fallback = calls().find(
      ([s]) => s.join("?").includes("SELECT id FROM movimientos") &&
        !s.join("?").includes("INSERT INTO movimientos"),
    );
    expect(fallback).toBeDefined();
    expect(fallback![0].join("?")).toContain("bodega_origen_id = ?");

    const vis = calls().find(([s]) =>
      s.join("?").includes("INSERT INTO movimiento_visaciones"),
    );
    expect(vis).toBeDefined();
    // values[0] = movimiento_id devuelto por el fallback
    expect(vis!.slice(1)).toContain(42);
  });

  // T4: reprocesar la misma bodega no crea otro movimiento; las visaciones
  // se cuelgan siempre del mismo id y la unique las deduplica.
  it("T4: doble sync de la misma bodega reusa el movimiento existente", async () => {
    let principal = 0;
    mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
      const text = strings.join("?");
      if (text.includes("FROM bodegas")) return BODEGAS;
      if (text.includes("INSERT INTO movimientos")) {
        principal++;
        return principal === 1 ? [{ id: 7 }] : [];
      }
      if (text.includes("SELECT id FROM movimientos")) return [{ id: 7 }];
      return [];
    });

    const params = {
      folio: "F-1", codigo: "COD-1", cantidad: 2, bodegaId: 1,
      visaciones: [{ nroIngreso: "NRO-1", cantidad: 2 }],
      fechanvt: "2026-07-01",
    };
    await insertarMovimientoSync(mockSql as never, params);
    await insertarMovimientoSync(mockSql as never, params);

    const vis = calls().filter(([s]) =>
      s.join("?").includes("INSERT INTO movimiento_visaciones"),
    );
    expect(vis).toHaveLength(2);
    for (const [strings, movimientoId] of vis) {
      expect(movimientoId).toBe(7);
      expect(strings.join("?")).toContain(
        "ON CONFLICT (movimiento_id, nro_ingreso) DO NOTHING",
      );
    }
    expect(principal).toBe(2); // ambas filas usan el guard, no un INSERT ciego
  });

  // T6: migración v1 sin target que dependa de la constraint renombrada.
  it("T6: migrar-salidas-v1 ya no usa ON CONFLICT (folio, producto_id)", () => {
    const src = readFileSync(
      join(process.cwd(), "lib", "sync", "migrar-salidas-v1.ts"),
      "utf8",
    );
    expect(src).not.toContain("ON CONFLICT (folio, producto_id)");
    expect(src).toContain("ON CONFLICT DO NOTHING");
  });
});

// ── R2: Watermark ──────────────────────────────────────────────────────
describe("R2 — watermark", () => {
  it("escribe como watermark la mayor fechconf procesada", async () => {
    mockGet.mockResolvedValue([
      // Confirmada tarde: fechconf 2026-09-15 debe ganarle a la corte.
      compra({ folio: "F-A", codigo: "A", fechanvt: "2026-07-01", fechconf: "2026-09-15" }),
      compra({ folio: "F-B", codigo: "B", fechanvt: "2026-08-03", fechconf: "2026-08-03" }),
    ]);

    const res = await syncComprasAnil("2026-06-18");

    expect(res.watermark).toBe("2026-09-15");

    const ultimo = calls()[calls().length - 1];
    const text = ultimo[0].join("?");
    expect(text).toContain("INSERT INTO sync_watermark");
    expect(ultimo.slice(1)).toContain("compras-anil");
    expect(ultimo.slice(1)).toContain("2026-09-15");
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
