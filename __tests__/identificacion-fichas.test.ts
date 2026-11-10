/**
 * Fase B — Módulo 1, Slice 3: generador de fichas visuales.
 * Sin red y sin DB real: fetch stubbeado, Gemini mockeado y el driver
 * neon-http reemplazado por un cliente que registra cada sentencia.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const { geminiMock, dbMock } = vi.hoisted(() => ({
  geminiMock: vi.fn(),
  dbMock: {
    consultas: [] as { sql: string; params: unknown[] }[],
    estado: { filas: [] as unknown[] },
  },
}));

vi.mock("@/lib/identificacion/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/gemini")>(
    "@/lib/identificacion/gemini"
  );
  return { ...actual, llamarGeminiJson: geminiMock };
});

vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const schema = await import("@/db/schema");
  const cliente = async (sql: string, params: unknown[]) => {
    dbMock.consultas.push({ sql, params });
    return { rows: dbMock.estado.filas };
  };
  return { db: drizzle(cliente as never, { schema }) };
});

import {
  PROMPT_FICHA_VERSION,
  generarFichasLote,
  getFichasVisuales,
  hashFicha,
  upsertFichas,
  urlMiniatura,
  validarFicha,
  type FichaVisual,
} from "@/lib/identificacion/fichas";

const FICHA: FichaVisual = {
  tipo_es: "audífonos",
  tipo_en: "headphones",
  colores: ["negro"],
  textos: ["BT-5"],
  marca: "ACME",
  rasgos: "plegables",
};

const URL_CLOUDINARY =
  "https://res.cloudinary.com/dxkidwxjl/image/upload/v1/productos/abc.jpg";
const URL_OTRA = "https://cdn.test/abc.jpg";

function imagen(): Response {
  return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
}

beforeEach(() => {
  dbMock.consultas.length = 0;
  dbMock.estado.filas = [];
  geminiMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("urlMiniatura()", () => {
  it("inserta la transformación después de /upload/ en Cloudinary", () => {
    expect(urlMiniatura(URL_CLOUDINARY)).toBe(
      "https://res.cloudinary.com/dxkidwxjl/image/upload/w_320,h_320,c_pad,b_white,f_jpg,q_70/v1/productos/abc.jpg"
    );
  });

  it("respeta px y devuelve intacta una URL que no es Cloudinary", () => {
    expect(urlMiniatura(URL_CLOUDINARY, 128)).toContain("/upload/w_128,h_128,");
    expect(urlMiniatura(URL_OTRA)).toBe(URL_OTRA);
  });
});

describe("hashFicha()", () => {
  it("es sha256 de url|versión y cambia con la URL", () => {
    const esperado = createHash("sha256")
      .update(`${URL_CLOUDINARY}|${PROMPT_FICHA_VERSION}`)
      .digest("hex");
    expect(hashFicha(URL_CLOUDINARY)).toBe(esperado);
    expect(hashFicha(URL_CLOUDINARY)).not.toBe(hashFicha(URL_OTRA));
    expect(PROMPT_FICHA_VERSION).toBe("v1");
    // Misma URL con otra versión de prompt debe dar otro hash.
    const otraVersion = createHash("sha256")
      .update(`${URL_CLOUDINARY}|v2`)
      .digest("hex");
    expect(hashFicha(URL_CLOUDINARY)).not.toBe(otraVersion);
  });
});

describe("validarFicha()", () => {
  it("acepta una ficha válida y recorta strings", () => {
    expect(
      validarFicha({
        ...FICHA,
        tipo_es: "  audífonos ",
        marca: " ACME ",
        colores: [" negro ", 7, ""],
      })
    ).toEqual({ ...FICHA, colores: ["negro"] });
  });

  it("limita textos a 8 y tolera arrays ausentes", () => {
    const ficha = validarFicha({
      tipo_es: "x",
      textos: Array.from({ length: 12 }, (_, i) => `t${i}`),
    });
    expect(ficha?.textos).toHaveLength(8);
    expect(ficha?.colores).toEqual([]);
    expect(ficha?.tipo_en).toBe("");
  });

  it("devuelve null sin tipo_es o si no es objeto", () => {
    expect(validarFicha({ tipo_es: "  " })).toBeNull();
    expect(validarFicha(null)).toBeNull();
    expect(validarFicha("texto")).toBeNull();
  });
});

describe("generarFichasLote()", () => {
  it("arma las parts en orden y usa timeout de 120 s", async () => {
    const fetchMock = vi.fn(async (_url: string) => imagen());
    vi.stubGlobal("fetch", fetchMock);
    geminiMock.mockResolvedValue([
      { codigo: "A", ...FICHA },
      { codigo: "B", ...FICHA },
    ]);

    const mapa = await generarFichasLote([
      { codigo: "A", imagenUrl: URL_CLOUDINARY },
      { codigo: "B", imagenUrl: URL_OTRA },
    ]);

    expect([...mapa.keys()]).toEqual(["A", "B"]);
    expect(fetchMock.mock.calls[0][0]).toBe(urlMiniatura(URL_CLOUDINARY));
    expect(fetchMock.mock.calls[1][0]).toBe(URL_OTRA);

    const [parts, opciones] = geminiMock.mock.calls[0];
    expect(parts[0].text).toContain("Vienen 2 imagenes de catalogo");
    expect(parts[1]).toEqual({ text: "Codigo: A" });
    expect(parts[2]).toEqual({
      inline_data: {
        mime_type: "image/jpeg",
        data: Buffer.from([1, 2, 3]).toString("base64"),
      },
    });
    expect(parts[3]).toEqual({ text: "Codigo: B" });
    expect(opciones).toEqual({ timeoutMs: 120_000 });
  });

  it("omite la miniatura que falla y no llama a Gemini si no queda ninguna", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(imagen())
    );
    geminiMock.mockResolvedValue([{ codigo: "B", ...FICHA }]);

    const mapa = await generarFichasLote([
      { codigo: "A", imagenUrl: URL_CLOUDINARY },
      { codigo: "B", imagenUrl: URL_OTRA },
    ]);

    expect([...mapa.keys()]).toEqual(["B"]);
    const [parts] = geminiMock.mock.calls[0];
    expect(parts.map((p: { text?: string }) => p.text).filter(Boolean)).toEqual([
      expect.stringContaining("Vienen 2 imagenes"),
      "Codigo: B",
    ]);

    geminiMock.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sin red")));
    await expect(
      generarFichasLote([{ codigo: "A", imagenUrl: URL_CLOUDINARY }])
    ).resolves.toEqual(new Map());
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("descarta códigos ajenos al lote y fichas inválidas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imagen()));
    geminiMock.mockResolvedValue([
      { codigo: "A", ...FICHA },
      { codigo: "Z", ...FICHA },
      { codigo: "B", tipo_es: "" },
    ]);

    const mapa = await generarFichasLote([
      { codigo: "A", imagenUrl: URL_CLOUDINARY },
      { codigo: "B", imagenUrl: URL_OTRA },
    ]);

    expect([...mapa.keys()]).toEqual(["A"]);
  });
});

describe("upsertFichas()", () => {
  it("un lote es una sola sentencia con ON CONFLICT (codigo)", async () => {
    await upsertFichas([
      { codigo: "A", ficha: FICHA, imagenHash: "h1", modelo: "m" },
      { codigo: "B", ficha: FICHA, imagenHash: "h2", modelo: "m" },
    ]);

    expect(dbMock.consultas).toHaveLength(1);
    const { sql, params } = dbMock.consultas[0];
    expect(sql).toMatch(/insert into "producto_fichas_visuales"/i);
    expect(sql).toMatch(/on conflict \("codigo"\) do update set/i);
    expect(sql).toContain("now()");
    expect(params).toEqual(expect.arrayContaining(["A", "B", "h1", "h2"]));
  });

  it("no ejecuta nada con un lote vacío", async () => {
    await upsertFichas([]);
    expect(dbMock.consultas).toEqual([]);
  });
});

describe("getFichasVisuales()", () => {
  it("con lista vacía devuelve mapa vacío sin consultar", async () => {
    await expect(getFichasVisuales([])).resolves.toEqual(new Map());
    expect(dbMock.consultas).toEqual([]);
  });

  it("con códigos filtra con IN y valida cada ficha", async () => {
    // neon-http entrega arrays (arrayMode), en el orden del SELECT.
    dbMock.estado.filas = [
      ["A", FICHA, "h1"],
      ["B", { tipo_es: "" }, null],
    ];

    const mapa = await getFichasVisuales(["A", "B"]);

    expect(dbMock.consultas).toHaveLength(1);
    expect(dbMock.consultas[0].sql.toLowerCase()).toContain(" in (");
    expect(dbMock.consultas[0].sql.toLowerCase()).not.toContain(" any(");
    expect(mapa.get("A")).toEqual({ ficha: FICHA, imagenHash: "h1" });
    expect(mapa.has("B")).toBe(false);
  });
});

describe("guarda estática", () => {
  function archivos(dir: string): string[] {
    try {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const ruta = resolve(dir, e.name);
        if (e.isDirectory()) return archivos(ruta);
        return /\.[jt]sx?$/.test(e.name) ? [ruta] : [];
      });
    } catch {
      return [];
    }
  }

  it("ningún archivo de app/ o components/ importa fichas ni gemini", () => {
    const raiz = resolve(__dirname, "..");
    const importadores = [resolve(raiz, "app"), resolve(raiz, "components")]
      .flatMap(archivos)
      .filter((f) => /lib\/identificacion\/(fichas|gemini)/.test(readFileSync(f, "utf8")));
    expect(importadores).toEqual([]);
  });
});
