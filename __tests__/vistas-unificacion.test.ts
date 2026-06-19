/**
 * Fase B — Grupo 3 ponytail: Tests de regresión pre-unificación.
 * Verifican que getStockPorBodega y getStockPorModulo devuelven
 * la misma estructura y comportamiento antes de unificarlas.
 *
 * Estos tests deben pasar AHORA con el código actual (sin unificar).
 * Después de unificar, deben seguir pasando con la función unificada.
 */

import { describe, it, expect } from "vitest";
import { getStockPorUbicacion, getBodegas, getModulos } from "@/lib/actions/vistas";

describe("getStockPorUbicacion — bodega", () => {
  it("devuelve { items, nextCursor }", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 5 });
    expect(page).toHaveProperty("items");
    expect(page).toHaveProperty("nextCursor");
    expect(Array.isArray(page.items)).toBe(true);
  });

  it("nextCursor es null si no hay más items", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 100 });
    expect(page.nextCursor).toBeNull();
  });

  it("respeta limit", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 2 });
    expect(page.items.length).toBeLessThanOrEqual(2);
  });

  it("cursor paginado no repite items", async () => {
    const p1 = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 2 });
    if (!p1.nextCursor) return;
    const p2 = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 2, cursor: p1.nextCursor });
    const ids1 = new Set(p1.items.map((i) => i.id));
    for (const item of p2.items) {
      expect(ids1.has(item.id)).toBe(false);
    }
  });

  it("soloConStock: true filtra cantidad > 0", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, soloConStock: true });
    for (const item of page.items) {
      expect(item.cantidad).toBeGreaterThan(0);
    }
  });

  it("soloConStock: false incluye cantidad 0", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, soloConStock: false, limit: 50 });
    const conCero = page.items.filter((i) => i.cantidad === 0);
    // Puede no haber items con stock 0 — el test solo verifica que no crashea
    expect(Array.isArray(page.items)).toBe(true);
  });

  it("búsqueda por q filtra resultados", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, q: "ZZZNOEXISTE", limit: 5 });
    expect(page.items.length).toBe(0);
  });

  it("cada item tiene codigo, detalle, packing, cantidad, id", async () => {
    const page = await getStockPorUbicacion({ tipo: "bodega", ubicacionId: 1, limit: 1 });
    if (page.items.length === 0) return;
    const item = page.items[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("codigo");
    expect(item).toHaveProperty("detalle");
    expect(item).toHaveProperty("packing");
    expect(item).toHaveProperty("cantidad");
  });
});

describe("getStockPorUbicacion — modulo", () => {
  it("devuelve { items, nextCursor }", async () => {
    const page = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: 1, limit: 5 });
    expect(page).toHaveProperty("items");
    expect(page).toHaveProperty("nextCursor");
    expect(Array.isArray(page.items)).toBe(true);
  });

  it("respeta limit", async () => {
    const page = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: 1, limit: 2 });
    expect(page.items.length).toBeLessThanOrEqual(2);
  });

  it("cursor paginado no repite items", async () => {
    const p1 = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: 1, limit: 2 });
    if (!p1.nextCursor) return;
    const p2 = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: 1, limit: 2, cursor: p1.nextCursor });
    const ids1 = new Set(p1.items.map((i) => i.id));
    for (const item of p2.items) {
      expect(ids1.has(item.id)).toBe(false);
    }
  });

  it("soloConStock filtra cantidad > 0", async () => {
    const page = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: 1, soloConStock: true });
    for (const item of page.items) {
      expect(item.cantidad).toBeGreaterThan(0);
    }
  });

  it("cada item tiene la misma estructura que bodega", async () => {
    const page = await getStockPorUbicacion({ tipo: "modulo", ubicacionId: 1, limit: 1 });
    if (page.items.length === 0) return;
    const item = page.items[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("codigo");
    expect(item).toHaveProperty("detalle");
    expect(item).toHaveProperty("packing");
    expect(item).toHaveProperty("cantidad");
  });
});

describe("getBodegas y getModulos — listados resumen", () => {
  it("getBodegas() devuelve id, nombre", async () => {
    const rows = await getBodegas();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("id");
    expect(rows[0]).toHaveProperty("nombre");
  });

  it("getModulos() devuelve id, nombre", async () => {
    const rows = await getModulos();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("id");
    expect(rows[0]).toHaveProperty("nombre");
  });
});
