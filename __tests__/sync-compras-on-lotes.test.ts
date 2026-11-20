/**
 * inv-22b-3 — backfill por lotes y guarda de tiempo del modo ON.
 * LIMITE_LOTE_COMPRAS = 100 (contrato); el mock de VD ignora el límite.
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
  limpiar,
  llamadas,
  mockGet,
  realSql,
  registrarHarness,
  setForward,
  textos,
} from "./helpers/sync-on-harness";

registrarHarness(mockSql);

const LIMITE = 100;

const lote = (n: number, fechconf: (i: number) => string) =>
  Array.from({ length: n }, (_, i) =>
    compra({ folio: cod(`F${i}`), codigo: cod(`P${i}`), fechconf: fechconf(i) }));

describe("ON — lotes", () => {
  it("lote lleno → pendientes y segunda corrida completa sin saltar ni duplicar", async () => {
    setForward(false);
    const total = LIMITE + 1;
    const todas = lote(total, (i) => (i < LIMITE ? "2026-01-01" : "2026-01-02"));

    mockGet.mockResolvedValueOnce(todas);
    const r1 = await syncComprasAnil("1900-01-01", { modo: "on" });
    expect(r1).toMatchObject({ procesadas: LIMITE, pendientes: true, watermark: "2026-01-02" });

    // Re-lectura inclusiva desde el watermark: repite la cola de la fecha ya vista.
    mockGet.mockResolvedValueOnce(todas.slice(LIMITE - 10));
    const r2 = await syncComprasAnil(r1.watermark, { modo: "on" });
    expect(r2).toMatchObject({ pendientes: false, watermark: "2026-01-02" });

    const folios = new Set(
      llamadas()
        .filter(([s]) => s.join("?").includes("INSERT INTO compras_importadas"))
        .map(([, folio]) => folio),
    );
    expect(folios.size).toBe(total);
  });

  it("D-1: la guarda no corta dentro del día del corte; completa el día y avanza", async () => {
    setForward(false);
    let t = 0;
    const ahora = () => (t += 3000);
    const todas = Array.from({ length: 6 }, (_, i) =>
      compra({
        folio: cod(`D1-${i}`),
        codigo: cod(`D1P-${i}`),
        fechconf: i < 4 ? "2026-03-01" : "2026-03-02",
      }));

    // El prefijo del día del corte (4 filas) ya supera la guarda (8 s).
    mockGet.mockResolvedValueOnce(todas);
    const r1 = await syncComprasAnil("2026-03-01", { modo: "on", ahora });
    // Completa todo el día del corte (4 filas) y recién ahí corta hacia el 03-02.
    expect(r1).toMatchObject({ procesadas: 4, pendientes: true, watermark: "2026-03-02" });

    mockGet.mockResolvedValueOnce(todas.slice(4));
    let t2 = 0;
    const r2 = await syncComprasAnil(r1.watermark, { modo: "on", ahora: () => (t2 += 3000) });
    expect(r2).toMatchObject({ procesadas: 2, pendientes: false, watermark: "2026-03-02" });
  });

  it("corte por tiempo → pendientes, watermark en la primera no procesada, siguiente completa", async () => {
    setForward(false);
    let t = 0;
    const ahora = () => (t += 3000);
    const todas = lote(5, (i) => `2026-03-0${i + 1}`);

    mockGet.mockResolvedValueOnce(todas);
    const r1 = await syncComprasAnil("1900-01-01", { modo: "on", ahora });
    expect(r1).toMatchObject({ procesadas: 3, pendientes: true, watermark: "2026-03-04" });

    mockGet.mockResolvedValueOnce(todas.slice(3));
    const r2 = await syncComprasAnil(r1.watermark, { modo: "on", ahora });
    expect(r2).toMatchObject({ procesadas: 2, pendientes: false, watermark: "2026-03-05" });
  });

  it("límite cae a mitad del último día → no lanza y la siguiente corrida completa ese día", async () => {
    setForward(false);
    const d1 = "2026-05-01", d2 = "2026-05-02";
    // Las últimas 10 filas del lote y la extra comparten d2 (> d1).
    const todas = lote(LIMITE + 1, (i) => (i < LIMITE - 10 ? d1 : d2));

    mockGet.mockResolvedValueOnce(todas);
    const r1 = await syncComprasAnil("1900-01-01", { modo: "on" });
    expect(r1).toMatchObject({ procesadas: LIMITE, pendientes: true, watermark: d2 });

    // Re-lectura inclusiva desde d2: completa el día sin duplicar ni saltar.
    mockGet.mockResolvedValueOnce(todas.slice(LIMITE - 10));
    const r2 = await syncComprasAnil(r1.watermark, { modo: "on" });
    expect(r2).toMatchObject({ procesadas: 11, pendientes: false, watermark: d2 });

    const folios = new Set(
      llamadas()
        .filter(([s]) => s.join("?").includes("INSERT INTO compras_importadas"))
        .map(([, folio]) => folio),
    );
    expect(folios.size).toBe(LIMITE + 1);
  });

  it("lote lleno de un solo día → error claro y sin watermark de ledger", async () => {
    setForward(false);
    mockGet.mockResolvedValue(lote(LIMITE + 1, () => "2026-02-02"));

    await expect(syncComprasAnil("1900-01-01", { modo: "on" })).rejects.toThrow(
      /LIMITE_LOTE_COMPRAS/,
    );
    // Sin watermark de ledger: el error ocurre antes de escribir compras.
    expect(textos().filter((t) => t.includes("INSERT INTO sync_watermark"))).toHaveLength(0);
    expect(textos().join("\n")).not.toContain("INSERT INTO compras_importadas");
  });

  it("lote corto → pendientes=false y watermark=maxFecha", async () => {
    setForward(false);
    mockGet.mockResolvedValue([
      compra({ folio: cod("C1"), codigo: cod("C1"), fechconf: "2026-04-01" }),
      compra({ folio: cod("C2"), codigo: cod("C2"), fechconf: "2026-04-03" }),
    ]);

    const r = await syncComprasAnil("1900-01-01", { modo: "on" });
    expect(r).toMatchObject({ procesadas: 2, pendientes: false, watermark: "2026-04-03" });
  });

  it("D4: sin filas y corte inicial no persiste watermark 1900-01-01", async () => {
    setForward(false);
    mockGet.mockResolvedValue([]);
    const r = await syncComprasAnil("1900-01-01", { modo: "on" });
    expect(r).toMatchObject({ procesadas: 0, watermark: "1900-01-01" });
    expect(textos().filter((t) => t.includes("INSERT INTO sync_watermark"))).toHaveLength(0);
  });

  it("D7: cleanup del harness borra la key real compras-anil-desde", async () => {
    await realSql.query(
      `INSERT INTO sync_watermark (key,value) VALUES ('compras-anil-desde','2026-01-01')
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    );
    await limpiar();
    expect(
      await filas(`SELECT value FROM sync_watermark WHERE key='compras-anil-desde'`, []),
    ).toHaveLength(0);
  });
});
