import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ── Logica pura ───────────────────────────────────────────────────────

export function calcularTotal(precioUnitario: number | null, cantidad: number): number | null {
  if (precioUnitario === null) return null;
  return Math.round(precioUnitario * cantidad * 100) / 100;
}

export function formatearPrecio(valor: number | null): string {
  if (valor === null) return "---";
  return `USD ${valor.toFixed(2)}`;
}

describe("calcularTotal", () => {
  it("multiplica precio por cantidad correctamente", () => {
    expect(calcularTotal(9.50, 375)).toBe(3562.50);
  });

  it("retorna null si precio es null", () => {
    expect(calcularTotal(null, 100)).toBeNull();
  });

  it("redondea a 2 decimales", () => {
    expect(calcularTotal(14.8, 30)).toBe(444.00);
  });
});

describe("formatearPrecio", () => {
  it("formatea con prefijo USD", () => {
    expect(formatearPrecio(9.50)).toBe("USD 9.50");
  });

  it("devuelve --- para null", () => {
    expect(formatearPrecio(null)).toBe("---");
  });
});

// ── Contrato de schema ────────────────────────────────────────────────

describe("schema.ts — columna precio_unitario en movimientos", () => {
  it("tiene precioUnitario en la tabla movimientos", () => {
    const src = readFileSync(join(process.cwd(), "db", "schema.ts"), "utf-8");
    expect(src).toContain("precioUnitario");
  });

  it("es de tipo numeric o decimal", () => {
    const src = readFileSync(join(process.cwd(), "db", "schema.ts"), "utf-8");
    expect(src).toMatch(/precioUnitario.*numeric|decimal/);
  });
});

// ── Contrato de queries VD ────────────────────────────────────────────

describe("vidadigital/queries.ts — precdocd en CompraAnil", () => {
  it("tipo CompraAnil incluye precioUnitario", () => {
    const src = readFileSync(join(process.cwd(), "db", "vidadigital", "queries.ts"), "utf-8");
    expect(src).toContain("precioUnitario");
  });

  it("SELECT incluye precdocd", () => {
    const src = readFileSync(join(process.cwd(), "db", "vidadigital", "queries.ts"), "utf-8");
    expect(src).toContain("precdocd");
  });
});

// ── Contrato de sync ──────────────────────────────────────────────────

describe("compras-anil.ts — precioUnitario en insertarMovimientoSync", () => {
  it("insertarMovimientoSync acepta precioUnitario", () => {
    const src = readFileSync(join(process.cwd(), "lib", "sync", "compras-anil.ts"), "utf-8");
    expect(src).toContain("precioUnitario");
  });

  it("el INSERT de movimientos incluye precio_unitario", () => {
    const src = readFileSync(join(process.cwd(), "lib", "sync", "compras-anil.ts"), "utf-8");
    expect(src).toContain("precio_unitario");
  });
});

// ── Contrato de getProducto ───────────────────────────────────────────

describe("productos.ts — precioUnitario en getProducto", () => {
  it("getProducto selecciona precioUnitario de movimientos", () => {
    const src = readFileSync(join(process.cwd(), "lib", "actions", "productos.ts"), "utf-8");
    expect(src).toContain("precioUnitario");
  });
});

// ── Contrato del page ─────────────────────────────────────────────────

describe("productos/[id]/page.tsx — columna precio en tabla compras", () => {
  it("tabla de compras muestra precio unitario", () => {
    const src = readFileSync(
      join(process.cwd(), "app", "(dashboard)", "productos", "[id]", "page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/[Pp]recio/);
  });

  it("usa formatearPrecio o USD en el render", () => {
    const src = readFileSync(
      join(process.cwd(), "app", "(dashboard)", "productos", "[id]", "page.tsx"),
      "utf-8"
    );
    expect(src).toMatch(/USD|precioUnitario/);
  });
});