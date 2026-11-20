/**
 * inv-22b-2a — caracterización del camino OFF y del upsert, ya verde en HEAD.
 * ON (ledger) llega en 22b-2b.
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

import { syncComprasAnil, upsertProducto } from "@/lib/sync/compras-anil";
import {
  cod,
  compra,
  filas,
  mockGet,
  realSql,
  registrarHarness,
  setForward,
  tag,
  textos,
} from "./helpers/sync-on-harness";

registrarHarness(mockSql);

describe("upsert de producto", () => {
  it("packing/alias/observaciones/foto manuales sobreviven al upsert del sync", async () => {
    await upsertProducto(realSql, {
      codigo: cod("MANUAL"), detalle: "otro", cantcaja: 24, imagenUrl: "https://vd/x.jpg",
    });
    const [p] = await filas(
      `SELECT packing, codigo_personal, observaciones, imagen_url
       FROM productos WHERE codigo=$1`,
      [cod("MANUAL")],
    );
    expect(p).toEqual({
      packing: 12, codigo_personal: `${tag}-alias`,
      observaciones: "obs manual", imagen_url: "https://manual/x.jpg",
    });
  });
});

describe("OFF — camino actual", () => {
  it("escribe movimientos, sin ledger", async () => {
    setForward(false);
    mockGet.mockResolvedValue([compra()]);
    const res = await syncComprasAnil("2026-06-18");
    expect(res).toEqual({ procesadas: 1, watermark: "2026-10-02" });
    const t = textos().join("\n");
    expect(t).toContain("INSERT INTO movimientos");
    expect(t).not.toContain("compras_importadas");
  });
});
