/**
 * Fase B — Slice 11: Tests que intentan romper el historial de movimientos.
 * Riesgos: R1 cursor inestable, R2 filtro fechas inválidas, R3 auth.
 */

import { describe, it, expect } from "vitest";

// Import real — si el módulo no existe (Fase B), MODULE_NOT_FOUND.
import { getMovimientos } from "@/lib/actions/movimientos";

// ── R1: Paginación estable ─────────────────────────────────────────────
describe("getMovimientos() — paginación", () => {
  it("devuelve página con nextCursor", async () => {
    const page = await getMovimientos({ limit: 5 });
    expect(page).toHaveProperty("items");
    expect(page).toHaveProperty("nextCursor");
    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items.length).toBeLessThanOrEqual(5);
  });

  // R1: sin repetición entre páginas
  it("no repite items entre páginas", async () => {
    const p1 = await getMovimientos({ limit: 3 });
    if (!p1.nextCursor) return;

    const p2 = await getMovimientos({ limit: 3, cursor: p1.nextCursor });
    const ids1 = new Set(p1.items.map((i) => i.id));
    for (const item of p2.items) {
      expect(ids1.has(item.id)).toBe(false);
    }
  });

  it("cursor 0 devuelve vacío (ningún id < 0)", async () => {
    const page = await getMovimientos({ limit: 5, cursor: 0 });
    expect(page.items.length).toBe(0);
    expect(page.nextCursor).toBeNull();
  });
});

// ── Filtros ────────────────────────────────────────────────────────────
describe("getMovimientos() — filtros", () => {
  it("filtra por tipo", async () => {
    const page = await getMovimientos({ tipo: "entrada", limit: 10 });
    for (const item of page.items) {
      expect(item.tipo).toBe("entrada");
    }
  });

  it("filtra por productoId", async () => {
    const page = await getMovimientos({ productoId: 1, limit: 5 });
    for (const item of page.items) {
      expect(item.productoCodigo).toBeDefined();
    }
  });

  // R2: desde > hasta → no crashea, solo devuelve vacío o warning
  it("desde > hasta no crashea", async () => {
    const page = await getMovimientos({
      desde: "2026-12-31",
      hasta: "2026-01-01",
      limit: 5,
    });
    expect(Array.isArray(page.items)).toBe(true);
  });
});

// ── Estructura de datos ────────────────────────────────────────────────
describe("getMovimientos() — columnas", () => {
  it("cada item tiene las columnas esperadas", async () => {
    const page = await getMovimientos({ limit: 1 });
    if (page.items.length === 0) return;

    const item = page.items[0];
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("tipo");
    expect(item).toHaveProperty("cantidad");
    expect(item).toHaveProperty("productoCodigo");
    expect(item).toHaveProperty("productoDetalle");
    expect(item).toHaveProperty("observaciones");
    expect(item).toHaveProperty("createdAt");
  });
});
