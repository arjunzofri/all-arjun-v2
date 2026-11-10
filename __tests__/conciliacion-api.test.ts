/**
 * Fase B — Conciliación de compras, sub-slice 1C.
 * Rutas: GET /api/sync/conciliacion y log de auditoría en el POST del sync.
 * Sin conexión real: neon, auth, feature-flags y conciliarComprasAnil mockeados.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockSql } = vi.hoisted(() => ({ mockSql: vi.fn() }));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => mockSql),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/feature-flags", () => ({ flagActivo: vi.fn() }));

vi.mock("@/lib/sync/conciliacion-compras", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/sync/conciliacion-compras")>();
  return { ...actual, conciliarComprasAnil: vi.fn() };
});

vi.mock("@/lib/sync/compras-anil", () => ({ syncComprasAnil: vi.fn() }));

import { GET } from "@/app/api/sync/conciliacion/route";
import { POST } from "@/app/api/sync/compras-anil/route";
import { conciliarComprasAnil } from "@/lib/sync/conciliacion-compras";
import { syncComprasAnil } from "@/lib/sync/compras-anil";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockFlag = flagActivo as ReturnType<typeof vi.fn>;
const mockConciliar = conciliarComprasAnil as ReturnType<typeof vi.fn>;
const mockSync = syncComprasAnil as ReturnType<typeof vi.fn>;

type SqlCall = [TemplateStringsArray, ...unknown[]];
const calls = () => mockSql.mock.calls as unknown as SqlCall[];
const texts = () => calls().map(([s]) => s.join("?"));

const RESULTADO = {
  desde: "2026-07-01",
  cuadra: false,
  resumen: {
    notasRevisadas: 2,
    lineasVd: 2,
    lineasApp: 2,
    unidadesVd: 15,
    unidadesApp: 10,
    diferencias: 1,
    notasConDiferencias: 1,
  },
  diferencias: [
    {
      tipo: "falta_en_app",
      folio: "002331",
      codigo: "MK0-216",
      bodega: "Bodega 2 Vida Digital",
      cantidadVd: 13,
      cantidadApp: 0,
    },
  ],
};

const ADMIN = { user: { id: "62", role: "admin" } };
const OPERADOR = { user: { id: "9", role: "operador" } };

function getUrl(qs = "") {
  return new Request(`http://localhost/api/sync/conciliacion${qs}`);
}

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockResolvedValue([]);
  mockAuth.mockReset();
  mockFlag.mockReset();
  mockFlag.mockReturnValue(true);
  mockConciliar.mockReset();
  mockConciliar.mockResolvedValue(RESULTADO);
  mockSync.mockReset();
  mockSync.mockResolvedValue({
    procesadas: 3,
    watermark: "2026-08-01",
    conciliacion: RESULTADO,
  });
});

// ── 24-26: auth y flag ──────────────────────────────────────────────────
describe("GET /api/sync/conciliacion — gate", () => {
  it("24: sin sesión → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(getUrl("?desde=2026-07-01"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("No autorizado");
    expect(mockConciliar).not.toHaveBeenCalled();
  });

  it("25: operador → 403", async () => {
    mockAuth.mockResolvedValue(OPERADOR);
    const res = await GET(getUrl("?desde=2026-07-01"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Solo admin");
    expect(mockConciliar).not.toHaveBeenCalled();
  });

  it("26: flag off → 404", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockFlag.mockReturnValue(false);
    const res = await GET(getUrl("?desde=2026-07-01"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Conciliación deshabilitada");
    expect(mockConciliar).not.toHaveBeenCalled();
  });
});

// ── 27: resolución de desde ─────────────────────────────────────────────
describe("GET /api/sync/conciliacion — desde", () => {
  it("27a: usa compras-anil-desde cuando existe", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockSql.mockResolvedValueOnce([
      { key: "compras-anil-desde", value: "2026-06-15" },
      { key: "compras-anil", value: "2026-09-01" },
    ]);

    const res = await GET(getUrl());
    expect(res.status).toBe(200);
    expect(mockConciliar).toHaveBeenCalledWith("2026-06-15");
  });

  it("27b: cae a compras-anil si no hay key de origen", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockSql.mockResolvedValueOnce([
      { key: "compras-anil", value: "2026-06-20" },
    ]);

    await GET(getUrl());
    expect(mockConciliar).toHaveBeenCalledWith("2026-06-20");
  });

  it("27c: cae a 2026-05-01 si no hay ninguna key", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockSql.mockResolvedValueOnce([]);

    await GET(getUrl());
    expect(mockConciliar).toHaveBeenCalledWith("2026-05-01");
  });
});

// ── 28: validación de desde ─────────────────────────────────────────────
describe("GET /api/sync/conciliacion — desde inválido", () => {
  it("28: fecha inexistente o inyección → 400 sin consultar", async () => {
    mockAuth.mockResolvedValue(ADMIN);

    for (const desde of ["2026-13-40", "2026-02-30", "';DROP TABLE x;--", "2026-7-1"]) {
      mockSql.mockClear();
      mockConciliar.mockClear();
      const res = await GET(getUrl(`?desde=${encodeURIComponent(desde)}`));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("desde inválido");
      expect(mockSql).not.toHaveBeenCalled();
      expect(mockConciliar).not.toHaveBeenCalled();
    }
  });
});

// ── 29: GET ok + activity_log ───────────────────────────────────────────
describe("GET /api/sync/conciliacion — ok", () => {
  it("29: 200 con el resultado e INSERT en activity_log", async () => {
    mockAuth.mockResolvedValue(ADMIN);

    const res = await GET(getUrl("?desde=2026-07-01"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULTADO);
    expect(mockConciliar).toHaveBeenCalledWith("2026-07-01");

    const log = calls().find(([s]) => s.join("?").includes("INSERT INTO activity_log"));
    expect(log).toBeDefined();
    expect(log![0].join("?")).toContain("'conciliacion_compras'");
    expect(log![0].join("?")).toContain("'sync'");
    const valores = log!.slice(1);
    expect(valores).toContain(62);
    expect(valores.some((v) => typeof v === "string" && v.includes('"cuadra"'))).toBe(true);
  });
});

// ── 30-31: log best-effort en el POST ───────────────────────────────────
describe("POST /api/sync/compras-anil — log de conciliación", () => {
  it("30a: con conciliacion escribe activity_log y responde 200", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockSql.mockResolvedValue([{ value: "2026-06-01" }]);

    const res = await POST();
    expect(res.status).toBe(200);
    const log = calls().find(([s]) => s.join("?").includes("INSERT INTO activity_log"));
    expect(log).toBeDefined();
    expect(log![0].join("?")).toContain("'conciliacion_compras'");
  });

  it("30b: si el log falla, el POST sigue en 200", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockSql.mockImplementation(async (strings: TemplateStringsArray) => {
      if (strings.join("?").includes("INSERT INTO activity_log")) {
        throw new Error("log caído");
      }
      return [{ value: "2026-06-01" }];
    });

    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).procesadas).toBe(3);
  });

  it("31: sin conciliacion (flag off) no escribe activity_log", async () => {
    mockAuth.mockResolvedValue(ADMIN);
    mockSql.mockResolvedValue([{ value: "2026-06-01" }]);
    mockSync.mockResolvedValue({ procesadas: 3, watermark: "2026-08-01" });

    const res = await POST();
    expect(res.status).toBe(200);
    expect(texts().some((t) => t.includes("INSERT INTO activity_log"))).toBe(false);
  });
});
