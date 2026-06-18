/**
 * Fase B — Slice 01 / R1: Tests que intentan romper el proxy de auth.
 *
 * Riesgo: rutas /dashboard expuestas sin sesión → redirect no funciona.
 * Proxy en Next.js 16: export function proxy(req) en vez de middleware().
 *
 * Sin mock: intentamos importar el proxy real. Si el módulo no existe
 * (Fase B), vitest tira MODULE_NOT_FOUND → ROJO esperado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Import real del proxy — si no existe, este test rompe con error claro.
import { proxy } from "@/proxy";

// Mockeamos auth() para controlar sesión presente/ausente.
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

function req(pathname: string) {
  return new NextRequest(`https://app-arjun.local${pathname}`);
}

describe("proxy de auth (proxy.ts)", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Sin sesión → redirect ──────────────────────────────────────
  it("redirige a /login cuando NO hay sesión y se accede a /dashboard", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/dashboard"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login/);
  });

  it("redirige a /login desde sub-ruta /dashboard/productos sin sesión", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/dashboard/productos"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login/);
  });

  // ── Con sesión → deja pasar ────────────────────────────────────
  it("deja pasar a /dashboard cuando SÍ hay sesión", async () => {
    (auth as any).mockResolvedValue({
      user: { email: "op@arjun.local", role: "operador" },
    });
    const res = await proxy(req("/dashboard"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  // ── Rutas públicas no protegidas ───────────────────────────────
  it("NO protege /api/auth/* sin sesión (el login no funcionaría)", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/api/auth/callback/credentials"));

    expect(res.status).toBe(200);
  });

  // ── Redirect raíz con sesión ───────────────────────────────────
  it("redirige / → /dashboard si hay sesión", async () => {
    (auth as any).mockResolvedValue({
      user: { email: "admin@arjun.local", role: "admin" },
    });
    const res = await proxy(req("/"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
  });
});
