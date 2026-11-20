/**
 * inv-22b-2b — modo ON: solo ledger de compras.
 * Cero SQL a stock/movimientos/visaciones, sin conciliación, watermark propio.
 */
import { describe, expect, it, vi } from "vitest";

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => mockSql) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/db/vidadigital/queries", () => ({ getComprasAnilDesde: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: vi.fn(() => true) }));
vi.mock("@/lib/sync/conciliacion-compras", () => ({
  conciliarComprasAnil: vi.fn(),
  getDesdeConciliacion: vi.fn(),
}));

import { syncComprasAnil } from "@/lib/sync/compras-anil";
import {
  cod,
  compra,
  filas,
  mockConcil,
  mockGet,
  realSql,
  registrarHarness,
  textos,
} from "./helpers/sync-on-harness";

registrarHarness(mockSql);

describe("ON — solo ledger", () => {
  it("cero SQL a stock/movimientos, sin conciliación, fila en el ledger", async () => {
    mockGet.mockResolvedValue([compra()]);
    const res = await syncComprasAnil("1900-01-01", { modo: "on" });
    expect(res).toEqual({ procesadas: 1, watermark: "2026-10-02" });
    expect(mockConcil).not.toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalledWith("1900-01-01", { incluirSinMetadata: true });
    const t = textos().join("\n");
    for (const s of ["INSERT INTO stock", "INSERT INTO movimientos", "movimiento_visaciones"])
      expect(t).not.toContain(s);
    const [l] = await filas(
      `SELECT cantidad, bodega_codigo, fecha_confirmacion::text AS fc
       FROM compras_importadas WHERE folio=$1`,
      [cod("F1")],
    );
    expect(l).toMatchObject({ cantidad: 5, bodega_codigo: "GLP", fc: "2026-10-02" });
    const [n] = await filas(
      `SELECT (SELECT count(*) FROM stock WHERE producto_id=p.id)::int s,
              (SELECT count(*) FROM movimientos WHERE producto_id=p.id)::int m
       FROM productos p WHERE codigo=$1`,
      [cod("P1")],
    );
    expect(n).toEqual({ s: 0, m: 0 });
  });

  it("GL desconocido y compra sin metadata entran al ledger", async () => {
    mockGet.mockResolvedValue([
      compra({ folio: cod("GLX"), codigo: cod("PGLX"), bodegaCodigo: "GLX", bodega: "Bodega desconocida" }),
      compra({ folio: cod("NOMETA"), codigo: cod("PNOMETA"), detalle: null, bodegaCodigo: null }),
    ]);
    const res = await syncComprasAnil("1900-01-01", { modo: "on" });
    expect(res.procesadas).toBe(2);
    const rows = await filas(
      `SELECT folio, bodega_codigo FROM compras_importadas
       WHERE folio IN ($1,$2) ORDER BY folio`,
      [cod("GLX"), cod("NOMETA")],
    );
    expect(rows).toEqual([
      { folio: cod("GLX"), bodega_codigo: "GLX" },
      { folio: cod("NOMETA"), bodega_codigo: null },
    ]);
    const [p] = await filas<{ detalle: string | null }>(
      `SELECT detalle FROM productos WHERE codigo=$1`, [cod("PNOMETA")],
    );
    expect(p.detalle).toBeNull();
  });

  it("replay no duplica; watermark ON no retrocede y la key legacy intacta", async () => {
    const antes = await filas(`SELECT value FROM sync_watermark WHERE key='compras-anil'`, []);
    await realSql.query(
      `INSERT INTO sync_watermark (key,value) VALUES ('compras-anil-ledger','2026-11-10')
       ON CONFLICT (key) DO UPDATE SET value='2026-11-10'`, [],
    );
    mockGet.mockResolvedValue([compra({ folio: cod("REPLAY"), codigo: cod("PREP"), fechconf: "2026-11-05" })]);
    const r1 = await syncComprasAnil("2026-11-10", { modo: "on" });
    const r2 = await syncComprasAnil("2026-11-10", { modo: "on" });
    expect([r1.watermark, r2.watermark]).toEqual(["2026-11-10", "2026-11-10"]);
    expect(textos().join("\n")).toContain("GREATEST(sync_watermark.value, EXCLUDED.value)");
    expect(await filas(`SELECT count(*)::int n FROM compras_importadas WHERE folio=$1`, [cod("REPLAY")]))
      .toEqual([{ n: 1 }]);
    expect(await filas(`SELECT value FROM sync_watermark WHERE key='compras-anil'`, [])).toEqual(antes);
  });
});
