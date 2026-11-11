/**
 * Bug P-20261110-2158-8: el filtro de /movimientos no ofrece "ajuste"
 * aunque el enum de la DB sí lo tiene.
 */

import { describe, it, expect } from "vitest";
import { TIPOS_MOVIMIENTO } from "@/lib/constants";
import { tipoMovimientoEnum } from "@/db/schema";
import { getMovimientos } from "@/lib/actions/movimientos";

describe("filtro de tipos de /movimientos", () => {
  it("ofrece todos los tipos reales del enum (incluye ajuste)", () => {
    const valores = TIPOS_MOVIMIENTO.map((t) => t.value)
      .filter((v) => v !== "todas")
      .sort();
    expect(valores).toEqual([...tipoMovimientoEnum.enumValues].sort());
  });

  it("cada opcion tiene etiqueta legible y la opcion 'todas'", () => {
    expect(TIPOS_MOVIMIENTO[0]).toEqual({ value: "todas", label: "Todos los tipos" });
    for (const t of TIPOS_MOVIMIENTO) {
      expect(t.label.length).toBeGreaterThan(0);
    }
    const ajuste = TIPOS_MOVIMIENTO.find((t) => t.value === "ajuste");
    expect(ajuste?.label).toBe("Ajuste");
  });

  it("filtrar por ajuste devuelve solo ajustes", async () => {
    const page = await getMovimientos({ tipo: "ajuste", limit: 10 });
    for (const item of page.items) {
      expect(item.tipo).toBe("ajuste");
    }
  });
});
