/**
 * Fase B — Fix de mapeo de columnas en getComprasAnilDesde().
 *
 * El código actual usa i.codigo (siempre null/vacío) para el JOIN y
 * i.cantidad (siempre null) para la cantidad. Este test confirma que
 * la función hoy devuelve 0 filas o cantidad null — evidencia del bug
 * antes de aplicar el fix.
 *
 * Post-fix con codunico + cantsali, este mismo test debe pasar en verde
 * con datos reales de Vida Digital.
 */

import { describe, it, expect } from "vitest";
import { getComprasAnilDesde } from "@/db/vidadigital/queries";

describe("getComprasAnilDesde — mapeo de columnas (integración real)", () => {
  it("devuelve filas para >= 2026-05-01 (JOIN via codunico, cantidad via cantsali)", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    // Con el código actual (i.codigo + i.cantidad), esto devuelve 0.
    // Post-fix debe devolver > 0.
    expect(compras.length).toBeGreaterThan(0);
  });

  it("incluye el producto B200 con cantidad y detalle correctos", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    const b200 = compras.filter((c) => c.codigo === "B200");
    expect(b200.length).toBeGreaterThan(0);

    // Todas las filas de B200 deben tener cantidad definida
    for (const c of b200) {
      expect(c.cantidad).toBeGreaterThan(0);
      expect(c.detalle).toBeTruthy();
    }
  });

  it("la cantidad de cada fila es un número positivo (no null, no NaN)", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    for (const c of compras) {
      expect(typeof c.cantidad).toBe("number");
      expect(c.cantidad).toBeGreaterThan(0);
      expect(Number.isNaN(c.cantidad)).toBe(false);
    }
  });
});

// ── Agrupación por (folio, codigo, bodega) ──────────────────────────────

describe("getComprasAnilDesde — agrupación (GROUP BY folio, codigo, bodegaResuelta)", () => {
  it("folio 001653 + codigo 1055 (20 repeticiones) → una sola fila con cantidad sumada", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    const filas = compras.filter(
      (c) => c.folio === "001653" && c.codigo === "1055",
    );

    // Con GROUP BY debe haber exactamente 1 fila, no 20
    expect(filas.length).toBe(1);

    // La cantidad debe ser la suma de las 20 líneas originales
    // (cada una con cantsali = "450.00" → 20 × 450 = 9000)
    expect(filas[0].cantidad).toBe(9000);
  });

  it("folio 001698 + codigo 1160 (2 knumezet distintos, misma bodega GL1) → una sola fila", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    const filas = compras.filter(
      (c) => c.folio === "001698" && c.codigo === "1160",
    );

    // Debe colapsar en 1 fila (ambos knumezet → GL1)
    expect(filas.length).toBe(1);

    // 7 × 30 + 7 × 36 = 210 + 252 = 462
    expect(filas[0].cantidad).toBe(462);
    expect(filas[0].bodega).toBe("Bodega 2 Vida Digital");
  });

  it("control negativo: un folio/codigo sin repeticiones → sigue devolviendo 1 fila con su cantidad original", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    // Buscar un par que aparezca una sola vez
    const conteo = new Map<string, number>();
    for (const c of compras) {
      const k = `${c.folio}|${c.codigo}`;
      conteo.set(k, (conteo.get(k) ?? 0) + 1);
    }

    // Encontrar el primer par que aparece exactamente 1 vez
    let unico: { folio: string; codigo: string } | null = null;
    for (const [k, v] of conteo) {
      if (v === 1) {
        const [folio, codigo] = k.split("|");
        unico = { folio, codigo };
        break;
      }
    }

    expect(unico).not.toBeNull();

    const filas = compras.filter(
      (c) => c.folio === unico!.folio && c.codigo === unico!.codigo,
    );
    expect(filas.length).toBe(1);
    expect(filas[0].cantidad).toBeGreaterThan(0);
  });
});
