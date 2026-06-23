/**
 * Fase B — Columna Usuario en historial de movimientos
 *
 * Smoke test: getMovimientos() debe retornar el campo usuario.
 *
 * Fase B: getMovimientos todavía no incluye usuario — este test DEBE fallar.
 */

import { describe, it, expect } from "vitest";
import { getMovimientos } from "@/lib/actions/movimientos";

describe("getMovimientos — usuario", () => {
  it("T1 smoke: retorna campo usuario (string no vacío)", async () => {
    const result = await getMovimientos({ limit: 5 });
    expect(result.items.length).toBeGreaterThan(0);

    // Fase B: usuario no existe en MovimientoItem → TS error o undefined
    const m = result.items[0] as Record<string, unknown>;
    expect(m.usuario).toBeDefined();
    expect(typeof m.usuario).toBe("string");
    expect((m.usuario as string).length).toBeGreaterThan(0);
  });
});
