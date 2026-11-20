/**
 * inv-22b — harness compartido del sync de compras.
 * Base TEST real (DATABASE_URL redirigido por vitest.setup.ts), SQL del sync
 * reenviado a ella, guarda de host, fixtures por tag y cleanup.
 * Los vi.mock viven en cada test file (guardia tests-no-escriben-prod-sync).
 */
import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";
import { conciliarComprasAnil } from "@/lib/sync/conciliacion-compras";

export const mockGet = getComprasAnilDesde as ReturnType<typeof vi.fn>;
export const mockConcil = conciliarComprasAnil as ReturnType<typeof vi.fn>;
export const tag = `SYNC22B-${Date.now()}`;
export const cod = (s: string) => `${tag}-${s}`;

const BODEGAS = [
  { id: 1, nombre: "Bodega 1 Vida Digital" },
  { id: 2, nombre: "Bodega 2 Vida Digital" },
  { id: 3, nombre: "Bodega Arjun" },
];

export let realSql: ReturnType<typeof import("@neondatabase/serverless").neon>;
let calls: [TemplateStringsArray, ...unknown[]][] = [];
let forward = true;

export const textos = () => calls.map(([s]) => s.join("?"));
export const setForward = (v: boolean) => { forward = v; };
export const filas = <T,>(q: string, p: unknown[]) =>
  realSql.query(q, p) as Promise<T[]>;

export function compra(over: Record<string, unknown> = {}) {
  return {
    folio: cod("F1"),
    fechanvt: "2026-10-01",
    fechconf: "2026-10-02",
    codigo: cod("P1"),
    detalle: "Producto",
    cantidad: 5,
    cantcaja: 12,
    imagenUrl: null,
    bodega: "Bodega 1 Vida Digital",
    bodegaCodigo: "GLP",
    visaciones: [] as { nroIngreso: string; cantidad: number }[],
    precioUnitario: 100,
    ...over,
  };
}

async function limpiar() {
  const p = [`${tag}%`];
  await realSql.query("DELETE FROM compras_importadas WHERE folio LIKE $1", p);
  for (const q of [
    "DELETE FROM movimiento_visaciones WHERE movimiento_id IN (SELECT id FROM movimientos WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE $1))",
    "DELETE FROM movimientos WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE $1)",
    "DELETE FROM stock WHERE producto_id IN (SELECT id FROM productos WHERE codigo LIKE $1)",
  ]) await realSql.query(q, p);
  await realSql.query("DELETE FROM productos WHERE codigo LIKE $1", p);
  await realSql.query(
    "DELETE FROM sync_watermark WHERE key IN ('compras-anil-ledger','compras-anil-ledger-desde')",
    [],
  );
}

export function registrarHarness(mockSql: ReturnType<typeof vi.fn>) {
  beforeAll(async () => {
    const actual =
      await vi.importActual<typeof import("@neondatabase/serverless")>(
        "@neondatabase/serverless",
      );
    realSql = actual.neon(process.env.DATABASE_URL!);
    if (new URL(process.env.DATABASE_URL!).host === process.env.PROD_DATABASE_URL_HOST)
      throw new Error("DATABASE_URL apunta a producción: se aborta antes de ejecutar SQL");
    const ddl = readFileSync(
      join(process.cwd(), "db/migrations/0003_compras_importadas.sql"),
      "utf8",
    );
    for (const st of ddl.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter(Boolean))
      await realSql.query(st, []);
    await limpiar();
    await realSql.query(
      `INSERT INTO productos (codigo, detalle, packing, codigo_personal, observaciones, imagen_url)
       VALUES ($1,'manual',12,$2,'obs manual','https://manual/x.jpg')`,
      [cod("MANUAL"), `${tag}-alias`],
    );
  });

  afterAll(limpiar);

  beforeEach(() => {
    calls = [];
    forward = true;
    mockGet.mockReset();
    mockConcil.mockReset();
    mockSql.mockReset();
    mockSql.mockImplementation(async (s: TemplateStringsArray, ...v: unknown[]) => {
      calls.push([s, ...v]);
      const text = s.join("?");
      if (!forward) {
        if (text.includes("FROM bodegas")) return BODEGAS;
        if (text.includes("SELECT id FROM productos")) return [{ id: 1 }];
        return [];
      }
      let q = s[0];
      for (let i = 1; i < s.length; i++) q += `$${i}${s[i]}`;
      return realSql.query(q, v);
    });
  });
}
