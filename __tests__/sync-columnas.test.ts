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

    // 450 unidades (1 fila de itemdcto × cantsali=450, sin inflación del JOIN)
    expect(filas[0].cantidad).toBe(450);
  });

  it("folio 001698 + codigo 1160 (2 knumezet distintos, misma bodega GL1) → una sola fila", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");

    const filas = compras.filter(
      (c) => c.folio === "001698" && c.codigo === "1160",
    );

    // Debe colapsar en 1 fila (ambos knumezet → GL1)
    expect(filas.length).toBe(1);

    // 66 unidades (30 + 36 de las 2 filas de itemdcto, sin inflación del JOIN)
    expect(filas[0].cantidad).toBe(66);
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

// ── Deduplicación de public.productos (GROUP BY codigo) ─────────────────

describe("getComprasAnilDesde — JOIN con GROUP BY en public.productos", () => {
  it("1055: 1 fila, cantidad=450 (no 9000 — public.productos tiene 20 filas)", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");
    const filas = compras.filter((c) => c.codigo === "1055");
    // Con GROUP BY + MAX() en el JOIN: 1 fila con cantidad=450.
    // Sin el fix, el JOIN 1×20 duplica y la agrupación JS produce 9000.
    expect(filas.length).toBe(1);
    expect(filas[0].cantidad).toBe(450);
  });

  it("1160: 1 fila, cantidad=66 (no 462 — public.productos tiene 7 filas)", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");
    const filas = compras.filter((c) => c.codigo === "1160");
    expect(filas.length).toBe(1);
    expect(filas[0].cantidad).toBe(66);
  });

  it("HJ-80092-8: 2 folios distintos, total=50 (no 250 — public.productos tiene 5 filas)", async () => {
    const compras = await getComprasAnilDesde("2026-05-01");
    const filas = compras.filter((c) => c.codigo === "HJ-80092-8");
    // 2 compras distintas (folios 001653 y 001691)
    expect(filas.length).toBe(2);
    const total = filas.reduce((s, c) => s + c.cantidad, 0);
    expect(total).toBe(50);
  });
});
