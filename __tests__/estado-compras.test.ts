/**
 * inv-22d-1 — route ON registra activity_log y estado de compras.
 * Neon, auth, sync y flags mockeados: no toca DB ni VD.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  sql: vi.fn(),
  auth: vi.fn(),
  sync: vi.fn(),
  flags: { inventario_bodega: true } as Record<string, boolean>,
}));
vi.mock("@neondatabase/serverless", () => ({ neon: vi.fn(() => m.sql) }));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/sync/compras-anil", () => ({ syncComprasAnilInventario: m.sync, syncComprasAnil: vi.fn() }));
vi.mock("@/lib/sync/conciliacion-compras", () => ({ registrarConciliacion: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ flagActivo: (k: string) => m.flags[k] === true }));

import { POST } from "@/app/api/sync/compras-anil/route";
import { getEstadoCompras } from "@/lib/sync/estado-compras";

type Llamada = { texto: string; params: unknown[] };
let llamadas: Llamada[] = [];
let corridas: unknown[] = [];
let watermarks: unknown[] = [];
const logs = () => llamadas.filter((l) => l.texto.includes("INSERT INTO activity_log"));

beforeEach(() => {
  llamadas = []; corridas = []; watermarks = [];
  m.sql.mockReset();
  m.sql.mockImplementation(async (s: TemplateStringsArray, ...v: unknown[]) => {
    const texto = s.join("?");
    llamadas.push({ texto, params: v });
    if (texto.includes("FROM activity_log")) return corridas;
    if (texto.includes("FROM sync_watermark")) return watermarks;
    return [];
  });
  m.auth.mockResolvedValue({ user: { id: "62", username: "qa" } });
  m.flags.inventario_bodega = true;
  m.sync.mockReset();
});

describe("route ON registra activity_log", () => {
  it("corrida OK registra usuario, accion, entidad y detalles", async () => {
    m.sync.mockResolvedValue({
      procesadas: 2, insertadas: 1, omitidas: 0, pendientes: false, watermark: "2026-11-10",
    });
    expect((await POST()).status).toBe(200);
    const [log] = logs();
    expect(log.params.slice(0, 2)).toEqual([62, "sync_compras_inventario"]);
    expect(log.texto).toContain("'compras'");
    expect(String(log.params[2])).toContain('"ok":true');
    expect(String(log.params[2])).toContain('"watermark":"2026-11-10"');
  });

  it("error registra ok:false y responde 500", async () => {
    m.sync.mockRejectedValue(new Error("boom"));
    expect((await POST()).status).toBe(500);
    const [log] = logs();
    expect(String(log.params[2])).toContain('"ok":false');
  });

  it("409 ocupado no registra nada", async () => {
    m.sync.mockResolvedValue(null);
    expect((await POST()).status).toBe(409);
    expect(logs()).toHaveLength(0);
  });
});

describe("getEstadoCompras", () => {
  it("devuelve la ultima corrida y el watermark del ledger", async () => {
    corridas = [{
      detalles: { ok: true, insertadas: 4, procesadas: 5, watermark: "2026-11-10" },
      created_at: "2026-11-20T13:05:00.000Z",
    }];
    watermarks = [{ value: "2026-11-10" }];
    expect(await getEstadoCompras()).toEqual({
      ultima: {
        ok: true, insertadas: 4, procesadas: 5, watermark: "2026-11-10",
        createdAt: "2026-11-20T13:05:00.000Z",
      },
      watermark: "2026-11-10",
    });
  });

  it("sin corridas devuelve ultima null", async () => {
    expect(await getEstadoCompras()).toEqual({ ultima: null, watermark: null });
  });
});
