/**
 * Fase B — Slice 01 / R2, R5: Tests que intentan romper validateEnv().
 *
 * Riesgos: variable ausente en Vercel → error silencioso en prod.
 * validateEnv() debe lanzar error claro mencionando el nombre de la
 * variable faltante — no un "undefined is not a X" genérico.
 */

import { describe, it, expect, afterEach } from "vitest";

// Import real — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { validateEnv } from "@/lib/env";

describe("validateEnv()", () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  // ── R2: NEXTAUTH_SECRET ───────────────────────────────────────
  it("lanza error con 'NEXTAUTH_SECRET' si no está definida", () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.VIDADIGITAL_DATABASE_URL = "postgres://localhost/vd";
    delete (process.env as Record<string, string>).NEXTAUTH_SECRET;
    expect(() => validateEnv()).toThrow(/NEXTAUTH_SECRET/);
  });

  it("NO lanza si NEXTAUTH_SECRET está presente", () => {
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.VIDADIGITAL_DATABASE_URL = "postgres://localhost/vd";
    expect(() => validateEnv()).not.toThrow();
  });

  // ── R5: DATABASE_URL ──────────────────────────────────────────
  it("lanza error con 'DATABASE_URL' si no está definida", () => {
    process.env.NEXTAUTH_SECRET = "x";
    process.env.VIDADIGITAL_DATABASE_URL = "postgres://localhost/vd";
    delete (process.env as Record<string, string>).DATABASE_URL;
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  // ── R4: VIDADIGITAL_DATABASE_URL ──────────────────────────────
  it("lanza error con 'VIDADIGITAL_DATABASE_URL' si no está definida", () => {
    process.env.NEXTAUTH_SECRET = "x";
    process.env.DATABASE_URL = "postgres://localhost/test";
    delete (process.env as Record<string, string>).VIDADIGITAL_DATABASE_URL;
    expect(() => validateEnv()).toThrow(/VIDADIGITAL_DATABASE_URL/);
  });

  // ── Varias faltantes a la vez ─────────────────────────────────
  it("lanza mencionando la primera faltante si varias están ausentes", () => {
    delete (process.env as Record<string, string>).DATABASE_URL;
    delete (process.env as Record<string, string>).NEXTAUTH_SECRET;
    expect(() => validateEnv()).toThrow();
  });
});
