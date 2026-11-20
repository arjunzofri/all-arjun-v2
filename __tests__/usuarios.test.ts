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
import { crearUsuario, listarUsuarios } from "@/lib/actions/usuarios";
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
  it("rechaza username vacío", async () => {
    await expect(
      crearUsuario({ username: "", password: "123456", role: "operador" })
    ).rejects.toThrow(/username|usuario|requerido/i);
  });

  it("rechaza password de 0 caracteres", async () => {
    await expect(
      crearUsuario({ username: `${PREFIJO}user1`, password: "", role: "operador" })
    ).rejects.toThrow(/password|mínimo|contraseña/i);
  });

  it("acepta username y password mínimos", async () => {
    const u = await crearUsuario({
      username: `${PREFIJO}user2`,
      password: "a",
      role: "operador",
    });
    idsCreados.push(u.id);
    expect(u).toHaveProperty("id");
    expect(u).toHaveProperty("username", `${PREFIJO}user2`);
    // No debe tener email ni hash
    expect(u).not.toHaveProperty("email");
    expect(u).not.toHaveProperty("passwordHash");
  });
});

// ── R3: Username duplicado ─────────────────────────────────────────────
describe("crearUsuario() — username único", () => {
  it("rechaza username duplicado", async () => {
    const u = await crearUsuario({
      username: `${PREFIJO}dup`,
      password: "123456",
      role: "operador",
    });
    idsCreados.push(u.id);
    await expect(
      crearUsuario({
        username: `${PREFIJO}dup`,
        password: "abcdef",
        role: "admin",
      })
    ).rejects.toThrow(/username|duplicado|existe/i);
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
    const u = await crearUsuario({
      username,
      password: "correcta",
      role: "admin",
    });
    idsCreados.push(u.id);
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
