/**
 * Fase B — inv-21: con inventario_bodega ON, el proxy apaga las rutas y APIs
 * legacy. GET de página → 307 a /inventario; API y métodos no-GET → 404 JSON.
 * OFF → exactamente como hoy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

import { config, proxy } from "@/proxy";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const OPERADOR = { user: { email: "op@arjun.local", role: "operador" } };
const ADMIN = { user: { email: "admin@arjun.local", role: "admin" } };

const LEGACY = [
  "/entradas",
  "/salidas",
  "/retornos",
  "/transferencias",
  "/movimientos",
  "/bodegas",
  "/bodegas/1",
  "/modulos",
  "/modulos/1",
  "/productos",
];

function req(pathname: string, method = "GET") {
  return new NextRequest(`https://app-arjun.local${pathname}`, { method });
}

async function correr(
  pathname: string,
  opts: { method?: string; sesion?: unknown } = {},
) {
  vi.mocked(auth).mockResolvedValue(
    ("sesion" in opts ? opts.sesion : OPERADOR) as never,
  );
  return proxy(req(pathname, opts.method ?? "GET"));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FEATURE_INVENTARIO_BODEGA = "true";
});

afterEach(() => {
  delete process.env.FEATURE_INVENTARIO_BODEGA;
});

describe("inv-21 ON — páginas legacy", () => {
  it("R1/R6: toda la matriz legacy → 307 exacto a /inventario", async () => {
    for (const ruta of LEGACY) {
      const res = await correr(ruta);
      expect(res.status, ruta).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, ruta).toBe(
        "/inventario",
      );
    }
  });

  it("R4: /productos/ normaliza a lista; /productos/[id] no se bloquea", async () => {
    expect((await correr("/productos/")).status).toBe(307);
    expect((await correr("/productos/42")).status).toBe(200);
  });

  it("R2/R3: identificar nunca se bloquea, otras subrutas de /entradas sí", async () => {
    expect((await correr("/entradas/identificar")).status).toBe(200);
    expect((await correr("/entradas/identificar/")).status).toBe(200);
    expect((await correr("/entradas/otra")).status).toBe(307);
    expect((await correr("/entradas/identificar/x")).status).toBe(307);
  });

  it("R9: método no-GET a ruta legacy → 404, nunca 307", async () => {
    const res = await correr("/entradas", { method: "POST" });
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });

  it("R7: /inventario y /inventario/nuevo no se redirigen (sin loop)", async () => {
    expect((await correr("/inventario")).status).toBe(200);
    expect((await correr("/inventario/nuevo")).status).toBe(200);
  });

  it("excepciones: /productos/42, /usuarios admin, /inversion-mercaderia, / → 200", async () => {
    expect((await correr("/usuarios", { sesion: ADMIN })).status).toBe(200);
    expect((await correr("/inversion-mercaderia", { sesion: ADMIN })).status).toBe(200);
    expect((await correr("/")).status).toBe(200);
  });

  it("R11: query string no altera la decisión", async () => {
    const res = await correr("/entradas?codigo=X");
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/inventario");
  });
});

describe("inv-21 ON — APIs legacy", () => {
  it("R5/R13: /api/productos y /api/productos/por-bodega → 404 JSON", async () => {
    for (const ruta of ["/api/productos", "/api/productos/", "/api/productos/por-bodega?bodegaId=1"]) {
      const res = await correr(ruta);
      expect(res.status, ruta).toBe(404);
      expect(res.headers.get("location"), ruta).toBeNull();
      expect(res.headers.get("content-type")).toMatch(/json/);
      expect(await res.json()).toEqual({ error: "No disponible" });
    }
  });

  it("R14: /api/inversion/resumen y /api/inversion/por-codigo → 404 JSON", async () => {
    for (const ruta of ["/api/inversion/resumen", "/api/inversion/por-codigo?codigo=X"]) {
      const res = await correr(ruta);
      expect(res.status, ruta).toBe(404);
      expect(res.headers.get("location"), ruta).toBeNull();
      expect(await res.json()).toEqual({ error: "No disponible" });
    }
  });

  it("R5: excepciones de API no se bloquean", async () => {
    expect((await correr("/api/productos/42")).status).toBe(200);
    expect((await correr("/api/productos/buscar-historico?q=VD")).status).toBe(200);
    expect(
      (await correr("/api/productos/42/imagen", { method: "POST" })).status,
    ).toBe(200);
    expect(
      (await correr("/api/identificacion", { method: "POST" })).status,
    ).toBe(200);
  });

  it("no-GET a API legacy → 404 JSON (no redirect)", async () => {
    const res = await correr("/api/productos", { method: "DELETE" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No disponible" });
  });
});

describe("inv-21 ON — orden auth y matcher", () => {
  it("R10: sin sesión /entradas → /login (el gate va después)", async () => {
    const res = await correr("/entradas", { sesion: null });
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("R10: operador en /usuarios → 403 (no legacy)", async () => {
    expect((await correr("/usuarios")).status).toBe(403);
  });

  it("R12: matcher excluye _next, manifest e iconos; /manifest.json.bak atraviesa el gate", async () => {
    const coincide = (p: string) => new RegExp(`^${config.matcher[0]}$`).test(p);
    for (const p of ["/_next/static/chunk.js", "/manifest.json", "/icon-192.png"]) {
      expect(coincide(p), p).toBe(false);
    }
    expect(coincide("/manifest.json.bak")).toBe(true);
    expect((await correr("/manifest.json.bak")).status).toBe(200);
  });
});

describe("inv-21 OFF — todo pasa como hoy", () => {
  beforeEach(() => {
    process.env.FEATURE_INVENTARIO_BODEGA = "false";
  });

  it("R8: rutas legacy, API legacy e /inventario pasan sin 307/404 del gate", async () => {
    for (const ruta of [...LEGACY, "/api/productos", "/api/productos/por-bodega", "/api/inversion/resumen", "/api/inversion/por-codigo", "/inventario"]) {
      expect((await correr(ruta)).status, ruta).toBe(200);
    }
    expect((await correr("/entradas", { method: "POST" })).status).toBe(200);
  });
});
