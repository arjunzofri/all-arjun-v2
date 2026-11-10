/**
 * Fase B — Módulo 1, Slice 2: catálogo read-only + agrupación + tabla de fichas.
 *
 * T1–T21 del contrato aprobado, más:
 * - detalle más frecuente por código (AJUSTE 1).
 * - formato "NOMBRE: X; MODELO: ..." tokenizado por X (AJUSTE 3).
 *
 * Los bloques de integración usan la DB real (solo SELECT), como
 * vidadigital-queries.test.ts e inversion-lotes.test.ts.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  agruparCatalogo,
  getCatalogoIdentificacion,
  type GrupoCatalogo,
} from "@/lib/identificacion/catalogo";
import {
  getCatalogoVidaDigital,
  deduplicarCatalogo,
  type FilaCatalogoVD,
  type ProductoCatalogoVD,
} from "@/db/vidadigital/queries";
import * as schema from "@/db/schema";

// ── Helpers ──────────────────────────────────────────────────────────────
function fila(
  codigo: string,
  detalle: string | null,
  imagenUrl = `https://img.test/${encodeURIComponent(codigo)}.jpg`
): ProductoCatalogoVD {
  return { codigo, detalle, imagenUrl };
}

function cruda(
  codigo: string,
  detalle: string | null,
  imagenUrl: string | null
): FilaCatalogoVD {
  return { codigo, detalle, imagenUrl };
}

function grupoDe(grupos: GrupoCatalogo[], codigo: string): GrupoCatalogo {
  const g = grupos.find((x) => x.codigo === codigo);
  if (!g) throw new Error(`No existe grupo con codigo ${codigo}`);
  return g;
}

// ── 7.1 Unitarios de agruparCatalogo() ──────────────────────────────────
describe("agruparCatalogo()", () => {
  it("T1: 1124 + 1124(ANIL) es un grupo; preselecciona el código propio", () => {
    const grupos = agruparCatalogo(
      [
        fila("1124", "MASAJEADOR RECARGABLE 4EN1 FASCIAL GUN"),
        fila("1124(ANIL)", "MASAJEADOR RECARGABLE 4EN1 FASCIAL GUN"),
      ],
      new Set(["1124"])
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigo).toBe("1124");
    expect(grupos[0].codigos).toEqual(["1124", "1124(ANIL)"]);
  });

  it("T2: QAN-2414 + VD-QAN-2414; sin propios preselecciona alfabético", () => {
    const grupos = agruparCatalogo(
      [
        fila("VD-QAN-2414", "SET DE LLAVES TOOL"),
        fila("QAN-2414", "SET DE LLAVES TOOL"),
      ],
      new Set()
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigo).toBe("QAN-2414");
    expect(grupos[0].codigos).toEqual(["QAN-2414", "VD-QAN-2414"]);
  });

  it("T3: 002 vs VD-002 con descripciones distintas => dos grupos", () => {
    const grupos = agruparCatalogo(
      [
        fila("002", "MINI ALISADOR DE PELO HAIR STRAIGHTNER"),
        fila("VD-002", "VENTILADOR VIDA DIGITAL"),
      ],
      new Set()
    );
    expect(grupos).toHaveLength(2);
    expect(grupos.map((g) => g.codigo).sort()).toEqual(["002", "VD-002"]);
  });

  it("T4: varios códigos propios => gana el primero alfabético", () => {
    const grupos = agruparCatalogo(
      [
        fila("ETY-036", "SET DE JARDINERIA TOOL"),
        fila("ETY-036(ANIL)", "SET DE JARDINERIA TOOL"),
        fila("VD-ETY-036", "SET DE JARDINERIA TOOL"),
      ],
      new Set(["VD-ETY-036", "ETY-036(ANIL)"])
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigo).toBe("ETY-036(ANIL)");
  });

  it("T5: espacios y minúsculas se normalizan; propio en minúsculas matchea", () => {
    const grupos = agruparCatalogo(
      [
        fila(" 1124 ", "MASAJEADOR FASCIAL GUN"),
        fila("1124(anil)", "MASAJEADOR FASCIAL GUN"),
      ],
      new Set(["1124"])
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigo.trim().toUpperCase()).toBe("1124");
    expect(grupos[0].codigos).toHaveLength(2);
  });

  it("T6: dos filas con el mismo código exacto => una sola entrada", () => {
    const grupos = agruparCatalogo(
      [
        fila("1124", "MASAJEADOR FASCIAL GUN"),
        fila("1124", "MASAJEADOR FASCIAL GUN"),
      ],
      new Set()
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigos).toEqual(["1124"]);
  });

  it("T7: entrada vacía => []", () => {
    expect(agruparCatalogo([], new Set())).toEqual([]);
  });

  it("T8: una sola fila => grupo de un código", () => {
    const grupos = agruparCatalogo([fila("X-1", "PRODUCTO UNICO")], new Set());
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigos).toEqual(["X-1"]);
  });

  it("T9: detalle e imagen salen de la fila del código preseleccionado", () => {
    const grupos = agruparCatalogo(
      [
        fila("1124", "MASAJEADOR RECARGABLE", "https://img.test/a.jpg"),
        fila("1124(ANIL)", "MASAJEADOR RECARGABLE 4EN1", "https://img.test/b.jpg"),
      ],
      new Set(["1124(ANIL)"])
    );
    const g = grupoDe(grupos, "1124(ANIL)");
    expect(g.detalle).toBe("MASAJEADOR RECARGABLE 4EN1");
    expect(g.imagenUrl).toBe("https://img.test/b.jpg");
    expect(g.codigos[0]).toBe("1124(ANIL)");
  });

  it("T10: salida ordenada alfabéticamente por código preseleccionado", () => {
    const grupos = agruparCatalogo(
      [fila("ZS-9", "PRODUCTO Z"), fila("AAA-1", "PRODUCTO A")],
      new Set()
    );
    expect(grupos.map((g) => g.codigo)).toEqual(["AAA-1", "ZS-9"]);
  });

  it("T11: dos variantes con detalle null => no se agrupan", () => {
    const grupos = agruparCatalogo(
      [fila("1124", null), fila("1124(ANIL)", null)],
      new Set()
    );
    expect(grupos).toHaveLength(2);
  });

  it("formato NOMBRE: X; MODELO... tokeniza por X (1020-12V)", () => {
    const a =
      "NOMBRE: HERVIDOR DE AGUA 12V; COD.: 1020-12V; MODELO: 1020-12V; TIPO: M; MARCA: KETTLE; INF.ADIC.: .;";
    const b =
      "NOMBRE: HERVIDOR DE AGUA 12V; MODELO: 1020-12V; MARCA: KETTLE; TIPO: M; INF.ADIC.: .;";
    const grupos = agruparCatalogo(
      [fila("1020-12V", a), fila("VD-1020-12V", b)],
      new Set()
    );
    expect(grupos).toHaveLength(1);
    expect(grupos[0].codigos).toEqual(["1020-12V", "VD-1020-12V"]);
  });
});

// ── AJUSTE 1: detalle más frecuente + imagen única ──────────────────────
describe("deduplicarCatalogo()", () => {
  it("elige el detalle más frecuente del código", () => {
    const out = deduplicarCatalogo([
      cruda("1035", "MINI ALISADOR DE PELO", "https://img.test/1035.jpg"),
      cruda("1035", "MINI ALISADOR DE PELO", "https://img.test/1035.jpg"),
      cruda("1035", "MINI ESPUMADOR A PILA", "https://img.test/1035.jpg"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].detalle).toBe("MINI ALISADOR DE PELO");
  });

  it("empate de frecuencia => el más corto, luego alfabético", () => {
    const out = deduplicarCatalogo([
      cruda("X", "AA", "https://img.test/x.jpg"),
      cruda("X", "AA", "https://img.test/x.jpg"),
      cruda("X", "B", "https://img.test/x.jpg"),
      cruda("X", "B", "https://img.test/x.jpg"),
    ]);
    expect(out[0].detalle).toBe("B");
  });

  it("null solo si todas las filas del código son null", () => {
    const out = deduplicarCatalogo([
      cruda("Y", null, "https://img.test/y.jpg"),
      cruda("Y", null, "https://img.test/y.jpg"),
      cruda("Y", "REAL", "https://img.test/y.jpg"),
      cruda("Z", null, "https://img.test/z.jpg"),
      cruda("Z", null, "https://img.test/z.jpg"),
    ]);
    const [y, z] = out.sort((a, b) => a.codigo.localeCompare(b.codigo));
    expect(y.detalle).toBe("REAL");
    expect(z.detalle).toBeNull();
  });

  it("toma la única imagen no vacía y descarta códigos sin imagen", () => {
    const out = deduplicarCatalogo([
      cruda("A", "PRODUCTO A", null),
      cruda("A", "PRODUCTO A", ""),
      cruda("A", "PRODUCTO A", "https://img.test/a.jpg"),
      cruda("B", "SIN IMAGEN", null),
      cruda("C", "PRODUCTO C", "   "),
    ]);
    expect(out.map((f) => f.codigo)).toEqual(["A"]);
    expect(out[0].imagenUrl).toBe("https://img.test/a.jpg");
  });
});

// ── 7.2 Schema ──────────────────────────────────────────────────────────
describe("schema producto_fichas_visuales", () => {
  it("T12: existe schema.productoFichasVisuales", () => {
    expect(schema.productoFichasVisuales).toBeDefined();
  });

  it("T13: codigo es primary key", () => {
    expect(schema.productoFichasVisuales.codigo.primary).toBe(true);
    expect(schema.productoFichasVisuales.codigo.columnType).toBe("PgText");
  });

  it("T14: columnas mapeadas (ficha jsonb, imagen_hash, modelo, generado_en tz)", () => {
    const t = schema.productoFichasVisuales;
    expect(t.ficha.columnType).toBe("PgJsonb");
    expect(t.imagenHash.name).toBe("imagen_hash");
    expect(t.modelo.name).toBe("modelo");
    expect(t.generadoEn.columnType).toBe("PgTimestamp");
    expect(
      (t.generadoEn as unknown as { withTimezone: boolean }).withTimezone
    ).toBe(true);
    expect(t.generadoEn.notNull).toBe(true);
  });

  it("T15: sin foreign keys y con el nombre de tabla correcto", () => {
    const cfg = getTableConfig(schema.productoFichasVisuales);
    expect(cfg.name).toBe("producto_fichas_visuales");
    expect(cfg.foreignKeys).toHaveLength(0);
  });
});

// ── 7.3 Integración real contra Vida Digital (solo SELECT) ──────────────
describe("getCatalogoVidaDigital() real", () => {
  it("T16: devuelve filas (>1000, sin hardcodear el snapshot)", async () => {
    const filas = await getCatalogoVidaDigital();
    expect(filas.length).toBeGreaterThan(1000);
  });

  it("T17: código e imagen no vacíos en cada fila", async () => {
    const filas = await getCatalogoVidaDigital();
    for (const f of filas) {
      expect(f.codigo.trim()).not.toBe("");
      expect(f.imagenUrl.trim()).not.toBe("");
    }
  });

  it("T18: no hay código duplicado en el resultado", async () => {
    const filas = await getCatalogoVidaDigital();
    const codigos = filas.map((f) => f.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("T19: el query tarda menos de 10 s (margen amplio)", async () => {
    const inicio = Date.now();
    await getCatalogoVidaDigital();
    expect(Date.now() - inicio).toBeLessThan(10_000);
  });

  it("T20: getCatalogoIdentificacion() cumple el contrato end-to-end", async () => {
    const grupos = await getCatalogoIdentificacion();
    expect(grupos.length).toBeGreaterThan(1000);
    for (const g of grupos) {
      expect(g.codigos.length).toBeGreaterThan(0);
      expect(g.codigos).toContain(g.codigo);
      expect(g.codigos[0]).toBe(g.codigo);
      expect(new Set(g.codigos).size).toBe(g.codigos.length);
      expect(g.imagenUrl.trim()).not.toBe("");
    }
  });
});

// ── 7.4 Solo lectura ────────────────────────────────────────────────────
describe("catálogo — solo lectura a Vida Digital", () => {
  const fuentes = [
    resolve(__dirname, "../db/vidadigital/queries.ts"),
    resolve(__dirname, "../lib/identificacion/catalogo.ts"),
  ];

  it("T21: sin verbos de escritura SQL ni mutaciones de Drizzle", () => {
    for (const ruta of fuentes) {
      const src = readFileSync(ruta, "utf8");
      for (const verbo of ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "DROP", "ALTER", "CREATE"]) {
        expect(src).not.toMatch(new RegExp(`\\b${verbo}\\b`, "i"));
      }
      expect(src).not.toMatch(/\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
    }
  });
});
