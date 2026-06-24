import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ── Tests de contrato de upsertProducto ──────────────────────────────

describe("upsertProducto — acepta ubicacion", () => {
  it("la funcion acepta campo ubicacion en su firma", () => {
    const src = readFileSync(join(process.cwd(), "lib", "sync", "compras-anil.ts"), "utf-8");
    expect(src).toContain("ubicacion");
  });

  it("el SQL de upsert incluye ubicacion con COALESCE", () => {
    const src = readFileSync(join(process.cwd(), "lib", "sync", "compras-anil.ts"), "utf-8");
    expect(src).toMatch(/ubicacion.*COALESCE|COALESCE.*ubicacion/);
  });
});

// ── Tests de contrato de entradaSchema ───────────────────────────────

describe("entradas.ts — schema incluye ubicacion", () => {
  it("el schema valida ubicacion como string opcional", () => {
    const src = readFileSync(join(process.cwd(), "lib", "actions", "entradas.ts"), "utf-8");
    expect(src).toContain("ubicacion");
    expect(src).toMatch(/ubicacion.*optional|optional.*ubicacion/);
  });

  it("crearEntrada pasa ubicacion a upsertProducto", () => {
    const src = readFileSync(join(process.cwd(), "lib", "actions", "entradas.ts"), "utf-8");
    // Debe haber una referencia a ubicacion en el bloque donde se llama upsertProducto
    expect(src).toContain("ubicacion: ubicacion ?? null");
  });
});

// ── Tests de contrato del formulario ─────────────────────────────────

describe("entradas/page.tsx — campo ubicacion en el form", () => {
  it("tiene estado ubicacion", () => {
    const src = readFileSync(join(process.cwd(), "app", "(dashboard)", "entradas", "page.tsx"), "utf-8");
    expect(src).toContain("ubicacion");
  });

  it("tiene label Ubicacion en el JSX", () => {
    const src = readFileSync(join(process.cwd(), "app", "(dashboard)", "entradas", "page.tsx"), "utf-8");
    expect(src).toMatch(/Ubicaci/); // cubre Ubicacion y Ubicación
  });

  it("pasa ubicacion a crearEntrada", () => {
    const src = readFileSync(join(process.cwd(), "app", "(dashboard)", "entradas", "page.tsx"), "utf-8");
    expect(src).toContain("ubicacion: ubicacion.trim()");
  });
});

// ── Test puro: pre-fill de ubicacion al seleccionar producto ─────────

type SugerenciaConUbicacion = {
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
  packing: number | null;
  ubicacion: string | null;
};

export function applyProductoConUbicacion(item: SugerenciaConUbicacion) {
  return {
    codigo: item.codigo,
    detalle: item.detalle ?? "",
    imagenUrl: item.imagenUrl,
    packing: item.packing ?? null,
    ubicacion: item.ubicacion ?? "",
  };
}

describe("applyProductoConUbicacion", () => {
  it("pre-llena ubicacion cuando el producto la tiene", () => {
    const item: SugerenciaConUbicacion = {
      codigo: "B200", detalle: "Silla", imagenUrl: null, packing: 1, ubicacion: "Pasillo 3"
    };
    expect(applyProductoConUbicacion(item).ubicacion).toBe("Pasillo 3");
  });

  it("devuelve string vacio si ubicacion es null", () => {
    const item: SugerenciaConUbicacion = {
      codigo: "B200", detalle: null, imagenUrl: null, packing: null, ubicacion: null
    };
    expect(applyProductoConUbicacion(item).ubicacion).toBe("");
  });
});