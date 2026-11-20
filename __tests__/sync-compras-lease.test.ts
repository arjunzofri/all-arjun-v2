/**
 * inv-22c — lease y concurrencia del sync de compras en modo inventario.
 * Base TEST real; guarda de host y cleanup compartidos con el harness ON.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => mockSql) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/db/vidadigital/queries", () => ({ getComprasAnilDesde: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: vi.fn(() => true) }));
vi.mock("@/lib/sync/conciliacion-compras", () => ({
  conciliarComprasAnil: vi.fn(), getDesdeConciliacion: vi.fn(), registrarConciliacion: vi.fn(),
}));

import { POST } from "@/app/api/sync/compras-anil/route";
import { LEASE_MS_COMPRAS, adquirirLeaseCompras, liberarLeaseCompras,
  syncComprasAnil, syncComprasAnilInventario } from "@/lib/sync/compras-anil";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { cod, compra, filas, mockGet, realSql, registrarHarness, setForward,
  textos } from "./helpers/sync-on-harness";

registrarHarness(mockSql);

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockFlag = flagActivo as ReturnType<typeof vi.fn>;
const LEASE = "compras-anil-lease";
const hace1h = () => new Date(Date.now() - 3_600_000).toISOString();
const en1h = () => new Date(Date.now() + 3_600_000).toISOString();
const leaseRows = () => filas<{ value: string }>(`SELECT value FROM sync_watermark WHERE key=$1`, [LEASE]);
const borrarLease = () => realSql.query(`DELETE FROM sync_watermark WHERE key=$1`, [LEASE]);

afterAll(borrarLease);

beforeEach(async () => {
  await borrarLease();
  mockAuth.mockResolvedValue({ user: { id: "62", role: "admin" } });
  mockFlag.mockImplementation((k: string) => k === "inventario_bodega");
});

describe("lease de compras", () => {
  it("dos adquisiciones concurrentes: una sola gana", async () => {
    const [a, b] = await Promise.all([
      adquirirLeaseCompras(realSql),
      adquirirLeaseCompras(realSql),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const ganador = (a ?? b)!;
    expect((await leaseRows())[0].value.endsWith(`|${ganador.token}`)).toBe(true);
  });

  it("liberar permite readquirir; token ajeno no libera", async () => {
    const a = (await adquirirLeaseCompras(realSql))!;
    await liberarLeaseCompras(realSql, "token-ajeno");
    expect((await leaseRows())[0].value.endsWith(`|${a.token}`)).toBe(true);
    expect(await adquirirLeaseCompras(realSql)).toBeNull();
    await a.liberar();
    const b = await adquirirLeaseCompras(realSql);
    expect(b?.token).toBeTruthy();
    await b!.liberar();
  });

  it("lease vencido se puede tomar; TTL supera la guarda de 8 s", async () => {
    await realSql.query(`INSERT INTO sync_watermark (key,value) VALUES ($1,$2)`, [
      LEASE,
      `${hace1h()}|corrida-caida`,
    ]);
    const a = await adquirirLeaseCompras(realSql);
    expect(a).not.toBeNull();
    const expira = new Date((await leaseRows())[0].value.split("|")[0]).getTime();
    expect(expira).toBeGreaterThan(Date.now());
    expect(LEASE_MS_COMPRAS).toBeGreaterThan(8000);
    await a!.liberar();
  });
});

describe("sync ON concurrente y route", () => {
  it("Promise.all: una corrida escribe, la otra recibe ocupado, sin duplicados", async () => {
    mockGet.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 150));
      return [compra({ folio: cod("L1"), codigo: cod("LP1") })];
    });
    const [r1, r2] = await Promise.all([
      syncComprasAnilInventario(),
      syncComprasAnilInventario(),
    ]);
    const ganadores = [r1, r2].filter((r): r is NonNullable<typeof r> => r !== null);
    expect(ganadores).toHaveLength(1);
    expect(ganadores[0]).toMatchObject({ insertadas: 1 });
    expect(
      await filas(`SELECT count(*)::int n FROM compras_importadas WHERE folio=$1`, [cod("L1")]),
    ).toEqual([{ n: 1 }]);
  });

  it("route ON ocupado responde 409 sin correr el sync", async () => {
    await realSql.query(`INSERT INTO sync_watermark (key,value) VALUES ($1,$2)`, [
      LEASE,
      `${en1h()}|ocupado`,
    ]);
    const res = await POST();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Sincronización en curso", enCurso: true });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("D9: si liberar lanza, se propaga el error original del sync", async () => {
    const original = new Error("fallo del sync");
    mockGet.mockRejectedValue(original);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSql.mockImplementation(async (s: TemplateStringsArray) => {
      const texto = s.join("?");
      if (texto.includes("INSERT INTO sync_watermark")) return [{ value: "x" }];
      if (texto.includes("SELECT value FROM sync_watermark")) return [{ value: "2026-01-01" }];
      if (texto.includes("UPDATE sync_watermark")) {
        const e = new Error("liberar falló");
        e.name = "LiberarError";
        throw e;
      }
      return [];
    });
    await expect(syncComprasAnilInventario()).rejects.toBe(original);
    expect(errorLog.mock.calls.flat().join(" ")).toContain("LiberarError");
    errorLog.mockRestore();
  });

  it("OFF no toca la key de lease", async () => {
    mockFlag.mockReturnValue(false);
    setForward(false);
    mockGet.mockResolvedValue([]);
    await syncComprasAnil("2026-05-01");
    expect(textos().join("\n")).not.toContain(LEASE);
    expect(await leaseRows()).toHaveLength(0);
  });
});
