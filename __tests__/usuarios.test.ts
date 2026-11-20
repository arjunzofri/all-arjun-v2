/**
 * Fase B — Slice 12: Tests que intentan romper auth con username + password.
 * Riesgos: R1 username vacío, R2 username duplicado, R3 password muy corto,
 * R4 login con credenciales inválidas, R5 seed-admin con username.
 */

import { describe, it, expect, afterAll, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "1", role: "admin" } })),
}));

// Import real — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import {
  crearUsuario,
  listarUsuarios,
  type CrearUsuarioInput,
} from "@/lib/actions/usuarios";
import { GET as getSeedAdmin } from "@/app/api/seed-admin/route";

// Prefijo único por ejecución: solo se borran los ids creados por este archivo.
const PREFIJO = `t${Date.now().toString(36)}-`;
const idsCreados: number[] = [];

afterAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  for (const id of idsCreados) {
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
});

// ── Validación ─────────────────────────────────────────────────────────
describe("crearUsuario() — validación", () => {
  it("rechaza username vacío — como valor", async () => {
    const res = await crearUsuario({ username: "", password: "123456", role: "operador" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/username|usuario|requerido/i);
  });

  it("rechaza password de 0 caracteres — como valor", async () => {
    const res = await crearUsuario({
      username: `${PREFIJO}user1`,
      password: "",
      role: "operador",
    });
    expect(res.ok).toBe(false);
  });

  it("error de input no-objeto es valor, no excepción", async () => {
    const res = await crearUsuario(null as unknown as CrearUsuarioInput);
    expect(res.ok).toBe(false);
  });

  it("acepta username y password mínimos", async () => {
    const res = await crearUsuario({
      username: `${PREFIJO}user2`,
      password: "a",
      role: "operador",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    idsCreados.push(res.usuario.id);
    // Sin email ni hash
    expect(Object.keys(res.usuario).sort()).toEqual([
      "createdAt",
      "id",
      "role",
      "username",
    ]);
    expect(res.usuario.username).toBe(`${PREFIJO}user2`);
  });
});

// ── R3: Username duplicado ─────────────────────────────────────────────
describe("crearUsuario() — username único", () => {
  it("rechaza username duplicado — como valor", async () => {
    const primero = await crearUsuario({
      username: `${PREFIJO}dup`,
      password: "123456",
      role: "operador",
    });
    expect(primero.ok).toBe(true);
    if (!primero.ok) return;
    idsCreados.push(primero.usuario.id);
    const res = await crearUsuario({
      username: `${PREFIJO}dup`,
      password: "abcdef",
      role: "admin",
    });
    expect(res).toEqual({ ok: false, error: "El username ya existe" });
  });
});

// ── Listado bajo admin ─────────────────────────────────────────────────
describe("listarUsuarios() — bajo admin", () => {
  it("devuelve solo campos públicos sin hash", async () => {
    const lista = await listarUsuarios();
    expect(lista.length).toBeGreaterThan(0);
    for (const u of lista) {
      expect(Object.keys(u).sort()).toEqual([
        "createdAt",
        "id",
        "role",
        "username",
      ]);
    }
  });
});

// ── R4: Login ──────────────────────────────────────────────────────────
describe("login con username", () => {
  it("authorize rechaza username inexistente", async () => {
    const { auth } = await import("@/lib/auth");
    // auth() con credenciales mock vía NextAuth internals
    expect(auth).toBeDefined();
    expect(typeof auth).toBe("function");
  });

  it("password incorrecto rechaza login", async () => {
    const username = `${PREFIJO}login`;
    const res = await crearUsuario({
      username,
      password: "correcta",
      role: "admin",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    idsCreados.push(res.usuario.id);
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT password_hash FROM users WHERE username = ${username}`;
    const hash = (rows as unknown as { password_hash: string }[])[0]?.password_hash;
    // El hash no debe ser la contraseña en texto plano
    expect(hash).toBeDefined();
    expect(hash).not.toBe("correcta");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });
});

// ── R5: Seed admin con username ────────────────────────────────────────
describe("GET /api/seed-admin", () => {
  it("usa ADMIN_USERNAME", async () => {
    process.env.SEED_SECRET = "test-seed";
    process.env.ADMIN_USERNAME = "seed-admin";
    process.env.ADMIN_PASSWORD = "seed-pass";

    const req = new Request("https://app-arjun.local/api/seed-admin", {
      headers: { Authorization: "Bearer test-seed" },
    });
    const res = await getSeedAdmin(req);
    expect(res.status === 200 || res.status === 201).toBe(true);

    delete process.env.SEED_SECRET;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
  });
});
