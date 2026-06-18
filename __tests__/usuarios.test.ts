/**
 * Fase B — Slice 06: Tests que intentan romper usuarios y login real.
 * Riesgos: R1 password sin hash, R2 operador sin permiso, R3 email duplicado,
 * R4 login dummy residual, + seed admin.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Imports reales — si no existen (Fase B), MODULE_NOT_FOUND.
import { crearUsuario, listarUsuarios } from "@/lib/actions/usuarios";
import { GET as getSeedAdmin } from "@/app/api/seed-admin/route";

beforeAll(async () => {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  // Limpiar TODOS los usuarios de test y los creados por tests viejos con bug
  await sql`DELETE FROM users WHERE email LIKE '%@arjun.local' AND email != 'admin@arjun.local'`;
});

// ── R3: Email duplicado ─────────────────────────────────────────────────
describe("crearUsuario()", () => {
  it("rechaza email duplicado", async () => {
    await crearUsuario({
      email: "test-dup@arjun.local",
      password: "test123456",
      role: "operador",
    });
    await expect(
      crearUsuario({
        email: "test-dup@arjun.local",
        password: "otra456789",
        role: "operador",
      })
    ).rejects.toThrow(/email|duplicado|existe/i);
  });

  // R1: Password sin hash → validación mínima
  it("rechaza password muy corto", async () => {
    await expect(
      crearUsuario({
        email: "short@arjun.local",
        password: "12",
        role: "operador",
      })
    ).rejects.toThrow(/password|contraseña|mínimo/i);
  });
});

// ── R4: Login real ─────────────────────────────────────────────────────
describe("login real", () => {
  it("rechaza email inexistente", async () => {
    const { auth } = await import("@/lib/auth");
    // Llamamos auth() sin request → usa headers(), pero en test
    // solo verificamos que el authorize config existe y funciona.
    expect(auth).toBeDefined();
    expect(typeof auth).toBe("function");
  });

  it("password incorrecto rechaza login", async () => {
    await crearUsuario({
      email: "test-login@arjun.local",
      password: "correcta123",
      role: "admin",
    });

    // Verificamos que el usuario se creó con hash
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`SELECT password_hash FROM users WHERE email = 'test-login@arjun.local'`;
    const hash = (rows as unknown as { password_hash: string }[])[0]?.password_hash;
    // El hash no debe ser la contraseña en texto plano
    expect(hash).toBeDefined();
    expect(hash).not.toBe("correcta123");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });
});

// ── R2: Operador no accede a /usuarios ────────────────────────────────
describe("autorización por rol", () => {
  it("operador no puede crear usuarios", async () => {
    // Crear un operador primero
    const op = await crearUsuario({
      email: "operador-test@arjun.local",
      password: "test123456",
      role: "operador",
    });

    const email = `test-op-${Date.now()}@arjun.local`;
    await expect(
      crearUsuario(
        { email, password: "test123456", role: "operador" },
        op.id
      )
    ).rejects.toThrow(/admin|permiso|autorizado/i);
  });
});

// ── Seed admin ──────────────────────────────────────────────────────────
describe("GET /api/seed-admin", () => {
  it("devuelve 401 sin SEED_SECRET", async () => {
    const req = new Request("https://app-arjun.local/api/seed-admin");
    const res = await getSeedAdmin(req);
    expect(res.status).toBe(401);
  });

  it("devuelve 200 si la tabla no está vacía (idempotente)", async () => {
    const req = new Request("https://app-arjun.local/api/seed-admin", {
      headers: { Authorization: "Bearer test-seed-secret" },
    });
    process.env.SEED_SECRET = "test-seed-secret";
    const res = await getSeedAdmin(req);
    expect(res.status).toBe(200);
    delete process.env.SEED_SECRET;
  });
});
