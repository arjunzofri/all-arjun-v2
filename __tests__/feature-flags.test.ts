/**
 * Fase B — Módulo 2, Slice 3: lector de feature flags.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// El JSON se mockea con estado mutable para poder probar true/false/no-booleano.
const state = vi.hoisted(() => ({
  flags: { inversion_mercaderia: false } as Record<string, unknown>,
}));

vi.mock("@/config/feature-flags.json", () => ({ default: state.flags }));

import { flagActivo } from "@/lib/feature-flags";

describe("flagActivo()", () => {
  it("el JSON real define inversion_mercaderia como booleano", () => {
    const actual = JSON.parse(
      readFileSync(resolve(__dirname, "../config/feature-flags.json"), "utf8")
    );
    expect(typeof actual.inversion_mercaderia).toBe("boolean");

    state.flags.inversion_mercaderia = false;
    expect(flagActivo("inversion_mercaderia")).toBe(false);
  });

  it("devuelve true solo si el valor es exactamente true", () => {
    state.flags.inversion_mercaderia = true;
    expect(flagActivo("inversion_mercaderia")).toBe(true);
  });

  it("devuelve false (no lanza) si el valor no es booleano true", () => {
    state.flags.inversion_mercaderia = "yes";
    expect(flagActivo("inversion_mercaderia")).toBe(false);

    delete state.flags.inversion_mercaderia;
    expect(flagActivo("inversion_mercaderia")).toBe(false);
  });

  it("una clave inexistente es error de TypeScript, no un true silencioso", () => {
    // @ts-expect-error — clave fuera de config/feature-flags.json
    expect(flagActivo("no_existe")).toBe(false);
  });
});
