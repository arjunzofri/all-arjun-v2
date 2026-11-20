/**
 * inv-22e — endpoint cron-job.org: auth por CRON_SECRET, modo ON y registro.
 * Neon, auth, sync y flags mockeados: no toca DB ni VD.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  sql: vi.fn(),
  auth: vi.fn(),
  sync: vi.fn(),
  syncLegacy: vi.fn(),
  flags: { inventario_bodega: true } as Record<string, boolean>,
}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => m.sql) }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/sync/compras-anil", () => ({
  syncComprasAnilInventario: m.sync,
  syncComprasAnil: m.syncLegacy,
}));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: (k: string) => m.flags[k] === true }));

import { POST } from "@/app/api/sync/compras-anil/cron/route";
import { proxy } from "@/proxy";
const SECRETO = "s3creto-de-prueba";
let llamadas: { texto: string; params: unknown[] }[] = [];
const logs = () => llamadas.filter((l) => l.texto.includes("INSERT INTO activity_log"));

function req(headers: Record<string, string> = {}, url = "https://app.local/api/sync/compras-anil/cron") {
  return new NextRequest(url, { method: "POST", headers });
}
const AUTH = { authorization: `Bearer ${SECRETO}` };
const OK = { procesadas: 3, insertadas: 2, omitidas: 1, pendientes: false, watermark: "2026-11-10" };

beforeEach(() => {
  llamadas = [];
  process.env.CRON_SECRET = SECRETO;
  m.sql.mockReset();
  m.sql.mockImplementation(async (s: TemplateStringsArray, ...v: unknown[]) => {
    const texto = s.join("?");
    llamadas.push({ texto, params: v });
    if (texto.includes("FROM users")) return [{ id: 7 }];
    return [];
  });
  m.auth.mockResolvedValue(null);
  m.flags.inventario_bodega = true;
  m.sync.mockReset().mockResolvedValue(OK);
  m.syncLegacy.mockReset();
});

afterEach(() => { delete process.env.CRON_SECRET; vi.restoreAllMocks(); });

describe("inv-22e — secreto", () => {
  it("sin CRON_SECRET o vacio -> 503 sin llamar sync", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(req(AUTH))).status).toBe(503);
    process.env.CRON_SECRET = "";
    expect((await POST(req({ authorization: "Bearer " }))).status).toBe(503);
    expect(m.sync).not.toHaveBeenCalled();
  });

  it("header ausente, incorrecto o largo distinto -> 401 sin sync", async () => {
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req({ authorization: "Bearer nope" }))).status).toBe(401);
    expect((await POST(req({ authorization: `Bearer ${SECRETO}x` }))).status).toBe(401);
    expect((await POST(req({ authorization: SECRETO }))).status).toBe(401);
    expect(m.sync).not.toHaveBeenCalled();
  });

  it("?secret= en query no autoriza y el secreto no aparece en la respuesta", async () => {
    const res = await POST(req({}, `https://app.local/api/sync/compras-anil/cron?secret=${SECRETO}`));
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain(SECRETO);
    expect(m.sync).not.toHaveBeenCalled();
  });
});

describe("inv-22e — modo y corrida", () => {
  it("flag OFF -> 409 y no llama ningun sync (nunca legacy)", async () => {
    m.flags.inventario_bodega = false;
    const res = await POST(req(AUTH));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Modo inventario apagado" });
    expect(m.sync).not.toHaveBeenCalled();
    expect(m.syncLegacy).not.toHaveBeenCalled();
  });

  it("ON ok -> 200 con contadores y registro origen cron con usuario admin", async () => {
    const res = await POST(req(AUTH));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(OK);
    const [log] = logs();
    expect(log.params.slice(0, 2)).toEqual([7, "sync_compras_inventario"]);
    expect(log.texto).toContain("'compras'");
    expect(String(log.params[2])).toContain('"origen":"cron"');
    expect(String(log.params[2])).toContain('"ok":true');
    expect(m.sync).toHaveBeenCalledTimes(1);
    expect(m.syncLegacy).not.toHaveBeenCalled();
  });

  it("ocupado (null) -> 409 enCurso sin registro", async () => {
    m.sync.mockResolvedValue(null);
    const res = await POST(req(AUTH));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Sincronización en curso", enCurso: true });
    expect(logs()).toHaveLength(0);
  });

  it("error -> 500 mensaje fijo, registro ok:false y secreto fuera de logs", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    m.sync.mockRejectedValue(new Error(`boom ${SECRETO}`));
    const res = await POST(req(AUTH));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error al actualizar las compras" });
    expect(String(logs()[0]?.params[2])).toContain('"ok":false');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRETO);
  });
});

describe("inv-22e — proxy", () => {
  it("la ruta cron exacta pasa sin sesion; variantes no son publicas", async () => {
    const get = (p: string) => proxy(new NextRequest(`https://app.local${p}`, { method: "POST" }));
    expect((await get("/api/sync/compras-anil/cron")).status).toBe(200);
    for (const p of ["/api/sync/compras-anil/cron/", "/api/sync/compras-anil/cronx"]) {
      const res = await get(p);
      expect(res.status, p).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, p).toBe("/login");
    }
  });
});
