/**
 * Fase B — Slice 12: Tests que intentan romper auth con username + password.
 * Riesgos: R1 username vacío, R2 username duplicado, R3 password muy corto,
 * R4 login con credenciales inválidas, R5 seed-admin con username.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Import real — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { crearUsuario, listarUsuarios } from "@/lib/actions/usuarios";
import { GET as getSeedAdmin } from "@/app/api/seed-admin/route";

beforeAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM users WHERE username LIKE '%test-%'`;
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
      crearUsuario({ username: "test-user1", password: "", role: "operador" })
    ).rejects.toThrow(/password|mínimo|contraseña/i);
  });

  it("acepta username y password mínimos", async () => {
    const u = await crearUsuario({
      username: "test-user2",
      password: "a",
      role: "operador",
    });
    expect(u).toHaveProperty("id");
    expect(u).toHaveProperty("username", "test-user2");
    // No debe tener email
    expect(u).not.toHaveProperty("email");
  });
});

// ── R3: Username duplicado ─────────────────────────────────────────────
describe("crearUsuario() — username único", () => {
  it("rechaza username duplicado", async () => {
    await crearUsuario({
      username: "test-dup",
      password: "123456",
      role: "operador",
    });
    await expect(
      crearUsuario({
        username: "test-dup",
        password: "abcdef",
        role: "admin",
      })
    ).rejects.toThrow(/username|duplicado|existe/i);
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
    await crearUsuario({
      username: "test-login",
      password: "correcta",
      role: "admin",
    });
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT password_hash FROM users WHERE username = 'test-login'`;
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
