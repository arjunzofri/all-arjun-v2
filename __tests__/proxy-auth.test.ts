/**
 * Fase B — Slice 01 / R1: Tests que intentan romper el proxy de auth.
 * Proxy en Next.js 16: protege todas las rutas excepto /login y /api/auth/*.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { proxy } from "@/proxy";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

function req(pathname: string) {
  return new NextRequest(`https://app-arjun.local${pathname}`);
}

describe("proxy de auth (proxy.ts)", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Sin sesión → redirect a login ───────────────────────────────
  it("redirige a /login sin sesión en /productos", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/productos"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login/);
  });

  it("redirige a /login sin sesión en /entradas", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/entradas"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login/);
  });

  // ── Con sesión → deja pasar ────────────────────────────────────
  it("deja pasar a /productos con sesión", async () => {
    (auth as any).mockResolvedValue({
      user: { email: "op@arjun.local", role: "operador" },
    });
    const res = await proxy(req("/productos"));
    expect(res.status).toBe(200);
  });

  // ── Rutas públicas no protegidas ────────────────────────────────
  it("NO protege /login sin sesión", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/login"));
    expect(res.status).toBe(200);
  });

  it("NO protege /api/auth/* sin sesión", async () => {
    (auth as any).mockResolvedValue(null);
    const res = await proxy(req("/api/auth/callback/credentials"));
    expect(res.status).toBe(200);
  });

  // ── Sesión en /login → redirect a raíz ──────────────────────────
  it("redirige /login a / si ya hay sesión", async () => {
    (auth as any).mockResolvedValue({
      user: { email: "admin@arjun.local", role: "admin" },
    });
    const res = await proxy(req("/login"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/$/);
  });

  // ── Control por rol ─────────────────────────────────────────────
  it("operador en /usuarios → 403", async () => {
    (auth as any).mockResolvedValue({
      user: { email: "op@arjun.local", role: "operador" },
    });
    const res = await proxy(req("/usuarios"));
    expect(res.status).toBe(403);
  });
});
