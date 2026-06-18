/**
 * Fase B — Slice 01 / R4: Tests que intentan romper la conexión
 * read-only a Vida Digital.
 *
 * Riesgo: VIDADIGITAL_DATABASE_URL inválida → app arranca sin
 *         warning y falla en runtime al usarla.
 *
 * El healthCheck() debe devolver { ok: boolean }, no lanzar.
 * Si el módulo no existe (Fase B), MODULE_NOT_FOUND.
 */

import { describe, it, expect } from "vitest";

// Import real — si no existe, este test rompe en Fase B.
import { getVidaDigitalClient, healthCheck } from "@/db/vidadigital";

describe("conexión Vida Digital", () => {
  it("getVidaDigitalClient() no lanza con URL válida en formato", () => {
    process.env.VIDADIGITAL_DATABASE_URL =
      process.env.VIDADIGITAL_DATABASE_URL ??
      "postgres://user:pass@localhost:5432/vidadigital";
    expect(() => getVidaDigitalClient()).not.toThrow();
  });

  it("healthCheck() devuelve { ok: boolean }, no lanza", async () => {
    const result = await healthCheck();

    expect(result).toHaveProperty("ok");
    expect(typeof result.ok).toBe("boolean");

    if (!result.ok && "error" in result) {
      // Si falla, debe traer mensaje — no objeto vacío.
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it("healthCheck() con URL inválida devuelve ok=false", async () => {
    // Guardamos y manipulamos para forzar fallo de conexión.
    const original = process.env.VIDADIGITAL_DATABASE_URL;
    process.env.VIDADIGITAL_DATABASE_URL =
      "postgres://fake:5432/nonexistent";

    const result = await healthCheck();
    expect(result.ok).toBe(false);

    process.env.VIDADIGITAL_DATABASE_URL = original;
  });
});
