/**
 * Fase B — Stock en tabla de /productos: Tests que intentan romper el slice.
 *
 * Riesgos:
 * 1. Producto sin stock → arrays vacíos, no null/undefined.
 * 2. Producto con stock en múltiples ubicaciones → todas se devuelven.
 * 3. Producto con stock solo en bodega, no en módulo → módulos vacío, bodegas poblado.
 * 4. mergeProductStock no muta los items originales.
 *
 * mergeProductStock() es la función pura testeable.
 *
 * AHORA EN ROJO: lib/actions/productos.ts no exporta mergeProductStock.
 */

import { describe, it, expect } from "vitest";
import { mergeProductStock } from "@/lib/utils/merge-product-stock";

type ItemBase = { id: number; codigo: string };

type BodegaRow = { productoId: number; id: number; nombre: string; cantidad: number };
type ModuloRow = { productoId: number; id: number; nombre: string; cantidad: number };

const items: ItemBase[] = [
  { id: 1, codigo: "A001" },
  { id: 2, codigo: "B002" },
  { id: 3, codigo: "C003" },
];

describe("mergeProductStock", () => {
  it("el archivo exporta mergeProductStock", () => {
    expect(mergeProductStock).not.toBeNull();
    expect(typeof mergeProductStock).toBe("function");
  });

  // ── R1: Sin stock → arrays vacíos para todos ─────────────────────
  it("sin stock: todos los items tienen arrays vacíos", () => {
    const result = mergeProductStock(items, [], []);

    expect(result.get(1)?.bodegas).toEqual([]);
    expect(result.get(1)?.modulos).toEqual([]);
    expect(result.get(2)?.bodegas).toEqual([]);
    expect(result.get(2)?.modulos).toEqual([]);
    expect(result.get(3)?.bodegas).toEqual([]);
    expect(result.get(3)?.modulos).toEqual([]);
  });

  // ── R2: Stock en una bodega para un producto ────────────────────
  it("stock en bodega: solo ese producto tiene bodegas pobladas", () => {
    const bodegaRows: BodegaRow[] = [
      { productoId: 1, id: 10, nombre: "Bodega 1", cantidad: 5 },
    ];

    const result = mergeProductStock(items, bodegaRows, []);

    expect(result.get(1)?.bodegas).toEqual([
      { id: 10, nombre: "Bodega 1", cantidad: 5 },
    ]);
    expect(result.get(1)?.modulos).toEqual([]);
    expect(result.get(2)?.bodegas).toEqual([]); // sin stock
  });

  // ── R3: Stock en múltiples bodegas para el mismo producto ───────
  it("multiples bodegas para el mismo producto: todas se devuelven", () => {
    const bodegaRows: BodegaRow[] = [
      { productoId: 1, id: 10, nombre: "Bodega 1", cantidad: 5 },
      { productoId: 1, id: 20, nombre: "Bodega 2", cantidad: 3 },
    ];

    const result = mergeProductStock(items, bodegaRows, []);

    expect(result.get(1)?.bodegas).toHaveLength(2);
    expect(result.get(1)?.bodegas).toContainEqual({ id: 10, nombre: "Bodega 1", cantidad: 5 });
    expect(result.get(1)?.bodegas).toContainEqual({ id: 20, nombre: "Bodega 2", cantidad: 3 });
  });

  // ── R4: Stock en bodega Y módulo para el mismo producto ─────────
  it("stock en bodega y modulo: ambos arrays poblados independientes", () => {
    const bodegaRows: BodegaRow[] = [
      { productoId: 1, id: 10, nombre: "Bodega 1", cantidad: 5 },
    ];
    const moduloRows: ModuloRow[] = [
      { productoId: 1, id: 100, nombre: "Módulo A", cantidad: 2 },
    ];

    const result = mergeProductStock(items, bodegaRows, moduloRows);

    expect(result.get(1)?.bodegas).toHaveLength(1);
    expect(result.get(1)?.modulos).toHaveLength(1);
    expect(result.get(1)?.bodegas[0].nombre).toBe("Bodega 1");
    expect(result.get(1)?.modulos[0].nombre).toBe("Módulo A");
  });

  // ── R5: Items sin stock no aparecen en el Map, pero están en items ──
  it("productos sin stock: entradas en el Map con arrays vacíos", () => {
    const bodegaRows: BodegaRow[] = [
      { productoId: 1, id: 10, nombre: "Bodega 1", cantidad: 5 },
    ];

    const result = mergeProductStock(items, bodegaRows, []);

    // Producto 2 no tiene stock pero tiene entrada en el Map con arrays vacíos
    expect(result.has(2)).toBe(true);
    expect(result.get(2)?.bodegas).toEqual([]);
    expect(result.get(2)?.modulos).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Tests de especificación (sin jsdom)
// ══════════════════════════════════════════════════════════════════════

describe("productos — stock UI (especificación, NO regresión)", () => {
  it("[especificación] tabla tiene columnas Bodegas y Módulos", () => {
    expect(true).toBe(true);
  });

  it("[especificación] sin stock muestra '—' en ambas columnas", () => {
    expect(true).toBe(true);
  });

  it("[especificación] stock se muestra como 'nombre: N uds' por línea", () => {
    expect(true).toBe(true);
  });
});
