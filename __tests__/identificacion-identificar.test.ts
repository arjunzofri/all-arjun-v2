/**
 * Fase B — Módulo 1, Slice 7: orquestador `identificarProducto`.
 * Sin red, sin Gemini y sin DB: todas las etapas mockeadas.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  catalogo: vi.fn(),
  fichas: vi.fn(),
  describir: vi.fn(),
  preseleccionar: vi.fn(),
  rerank: vi.fn(),
}));

vi.mock("@/lib/identificacion/catalogo", () => ({
  getCatalogoIdentificacion: mocks.catalogo,
}));
vi.mock("@/lib/identificacion/fichas", () => ({
  getFichasVisuales: mocks.fichas,
}));
vi.mock("@/lib/identificacion/describir", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/describir")>(
    "@/lib/identificacion/describir"
  );
  return { ...actual, describirFoto: mocks.describir };
});
vi.mock("@/lib/identificacion/preseleccion", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/preseleccion")>(
    "@/lib/identificacion/preseleccion"
  );
  return { ...actual, preseleccionar: mocks.preseleccionar };
});
vi.mock("@/lib/identificacion/rerank", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/rerank")>(
    "@/lib/identificacion/rerank"
  );
  return { ...actual, rerankPorTandas: mocks.rerank };
});

import type { GrupoCatalogo } from "@/lib/identificacion/catalogo";
import type { ImagenEntrada, InfoFoto } from "@/lib/identificacion/describir";
import type { ItemCatalogo } from "@/lib/identificacion/preseleccion";
import {
  ErrorIdentificacion,
  _resetCacheCatalogo,
  getItemsCatalogo,
  identificarProducto,
} from "@/lib/identificacion/identificar";

const IMAGEN: ImagenEntrada = { data: "Zm90bw==", mimeType: "image/jpeg" };

const INFO: InfoFoto = {
  tipo_producto_es: "audifonos",
  tipo_producto_en: "headphones",
  marca: "ACME",
  modelo: "BT-5",
  codigos_visibles: [],
  textos_visibles: [],
  palabras_clave: ["audifonos"],
  color: "negro",
};

function grupos(n: number): GrupoCatalogo[] {
  return Array.from({ length: n }, (_, i) => ({
    codigo: `G${i}`,
    codigos: [`G${i}`],
    detalle: `detalle G${i}`,
    imagenUrl: `https://cdn.test/G${i}.jpg`,
  }));
}

function codigos(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `G${i}`);
}

let ahora = 1_000;

beforeEach(() => {
  vi.clearAllMocks();
  ahora = 1_000;
  _resetCacheCatalogo();

  mocks.catalogo.mockResolvedValue(grupos(30));
  mocks.fichas.mockResolvedValue(new Map());
  mocks.describir.mockResolvedValue(INFO);
  mocks.preseleccionar.mockResolvedValue({
    candidatos: codigos(30),
    llm: [],
    kw: codigos(30),
  });
  mocks.rerank.mockResolvedValue([{ codigo: "G1", razon: "misma caja" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function reloj() {
  vi.spyOn(Date, "now").mockImplementation(() => ahora);
}

describe("orden de etapas", () => {
  it("catalogo → describir → preseleccionar → rerank, en ese orden", async () => {
    const orden: string[] = [];
    mocks.catalogo.mockImplementation(async () => {
      orden.push("catalogo");
      return grupos(3);
    });
    mocks.describir.mockImplementation(async () => {
      orden.push("describir");
      return INFO;
    });
    mocks.preseleccionar.mockImplementation(async () => {
      orden.push("preseleccionar");
      return { candidatos: codigos(3), llm: [], kw: [] };
    });
    mocks.rerank.mockImplementation(async () => {
      orden.push("rerank");
      return [];
    });

    await identificarProducto(IMAGEN);

    expect(orden).toEqual(["catalogo", "describir", "preseleccionar", "rerank"]);
  });

  it("arma el resultado con codigos, detalle, imagenUrl y razon del item", async () => {
    const resultado = await identificarProducto(IMAGEN);

    expect(resultado.opciones).toEqual([
      {
        codigo: "G1",
        codigos: ["G1"],
        detalle: "detalle G1",
        imagenUrl: "https://cdn.test/G1.jpg",
        razon: "misma caja",
        fuente: "visual",
      },
    ]);
    expect(resultado.candidatos).toBe(30);
    expect(resultado.tiempos.totalMs).toBeGreaterThanOrEqual(0);
  });
});

describe("opcion extra de preseleccion", () => {
  it("agrega al final el primer candidato por descripcion si el rerank lo descarto", async () => {
    mocks.preseleccionar.mockResolvedValue({ candidatos: codigos(30), llm: ["G5", "G6"], kw: [] });
    mocks.rerank.mockResolvedValue([
      { codigo: "G1", razon: "misma caja" },
      { codigo: "G2", razon: "similar" },
    ]);

    const { opciones } = await identificarProducto(IMAGEN);

    expect(opciones.map((o) => o.codigo)).toEqual(["G1", "G2", "G5"]);
    expect(opciones.map((o) => o.fuente)).toEqual(["visual", "visual", "preseleccion"]);
    expect(opciones[2]).toMatchObject({ razon: "Primer candidato por descripción", detalle: "detalle G5" });
  });

  it("no la agrega si el primer candidato ya esta entre los visuales", async () => {
    mocks.preseleccionar.mockResolvedValue({ candidatos: codigos(30), llm: ["G1", "G5"], kw: [] });

    const { opciones } = await identificarProducto(IMAGEN);

    expect(opciones).toHaveLength(1);
    expect(opciones[0].fuente).toBe("visual");
  });

  it("no la agrega con pre.llm vacio (fallback por palabras)", async () => {
    mocks.preseleccionar.mockResolvedValue({ candidatos: codigos(30), llm: [], kw: codigos(30) });

    const { opciones } = await identificarProducto(IMAGEN);

    expect(opciones.map((o) => o.codigo)).toEqual(["G1"]);
    expect(opciones.every((o) => o.fuente === "visual")).toBe(true);
  });

  it("nunca devuelve mas de 4 opciones", async () => {
    mocks.preseleccionar.mockResolvedValue({ candidatos: codigos(30), llm: ["G9"], kw: [] });
    mocks.rerank.mockResolvedValue(
      ["G1", "G2", "G3", "G4"].map((codigo) => ({ codigo, razon: "similar" }))
    );

    const { opciones } = await identificarProducto(IMAGEN);

    expect(opciones).toHaveLength(4);
    expect(opciones.some((o) => o.codigo === "G9")).toBe(false);
  });
});

describe("cache del catalogo", () => {
  it("reusa los items dentro del TTL y recarga al vencer", async () => {
    const a = await getItemsCatalogo(1_000);
    const b = await getItemsCatalogo(1_000 + 9 * 60_000);
    expect(mocks.catalogo).toHaveBeenCalledTimes(1);
    expect(b.items).toBe(a.items);

    await getItemsCatalogo(1_000 + 11 * 60_000);
    expect(mocks.catalogo).toHaveBeenCalledTimes(2);
  });

  it("si falla la recarga usa la cache vencida y agrega aviso", async () => {
    const { items } = await getItemsCatalogo(1_000);
    mocks.catalogo.mockRejectedValue(new Error("DB caida"));

    const { items: viejos, avisos } = await getItemsCatalogo(1_000 + 11 * 60_000);

    expect(viejos).toBe(items);
    expect(avisos.join(" ")).toMatch(/catalogo/i);
  });
});

describe("control de presupuesto", () => {
  it("con menos de 22 s restantes recorta a 24 candidatos y avisa", async () => {
    reloj();
    mocks.describir.mockImplementation(async () => {
      ahora += 5_000;
      return INFO;
    });
    mocks.preseleccionar.mockImplementation(async () => {
      ahora += 25_000;
      return { candidatos: codigos(30), llm: [], kw: [] };
    });

    const resultado = await identificarProducto(IMAGEN, { presupuestoMs: 45_000 });

    const itemsRerank = mocks.rerank.mock.calls[0][1] as ItemCatalogo[];
    expect(itemsRerank).toHaveLength(24);
    expect(resultado.candidatos).toBe(24);
    expect(resultado.avisos).toContain("candidatos recortados por tiempo");
  });

  it("con presupuesto agotado lanza error tipo tiempo y no llama al rerank", async () => {
    reloj();
    mocks.describir.mockImplementation(async () => {
      ahora += 20_000;
      return INFO;
    });
    mocks.preseleccionar.mockImplementation(async () => {
      ahora += 20_000;
      return { candidatos: codigos(3), llm: [], kw: [] };
    });

    await expect(
      identificarProducto(IMAGEN, { presupuestoMs: 30_000 })
    ).rejects.toMatchObject({ tipo: "tiempo" });
    expect(mocks.rerank).not.toHaveBeenCalled();
  });

  it("propaga el aviso cuando el modelo de preseleccion falla", async () => {
    mocks.preseleccionar.mockResolvedValue({
      candidatos: codigos(3),
      llm: [],
      kw: codigos(3),
      errorModelo: "HTTP 500",
    });

    const resultado = await identificarProducto(IMAGEN);

    expect(resultado.avisos.join(" ")).toMatch(/preseleccion/i);
  });
});

describe("mapeo de errores", () => {
  it("foto ilegible → tipo foto", async () => {
    mocks.describir.mockRejectedValue(new Error("No se pudo describir la foto"));
    await expect(identificarProducto(IMAGEN)).rejects.toMatchObject({
      tipo: "foto",
    });
  });

  it("cualquier otro fallo de etapa → tipo ia", async () => {
    mocks.describir.mockRejectedValue(new Error("Error de red o timeout"));
    await expect(identificarProducto(IMAGEN)).rejects.toMatchObject({
      tipo: "ia",
    });
  });

  it("ErrorIdentificacion es instanceof Error", () => {
    expect(new ErrorIdentificacion("tiempo", "x")).toBeInstanceOf(Error);
  });
});

describe("carrera contra el presupuesto", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("si describir cuelga, vence el plazo → tiempo y no preselecciona", async () => {
    mocks.describir.mockImplementation(() => new Promise(() => {}));

    const promesa = identificarProducto(IMAGEN, { presupuestoMs: 1_000 });
    const fallo = expect(promesa).rejects.toMatchObject({ tipo: "tiempo" });
    await vi.advanceTimersByTimeAsync(1_000);
    await fallo;
    expect(mocks.preseleccionar).not.toHaveBeenCalled();
  });

  it("si preseleccionar cuelga, cae a palabras y sin tiempo restante → tiempo", async () => {
    mocks.catalogo.mockResolvedValue(
      codigos(3).map((c) => ({
        codigo: c,
        codigos: [c],
        detalle: `audifonos ${c}`,
        imagenUrl: `https://cdn.test/${c}.jpg`,
      }))
    );
    mocks.preseleccionar.mockImplementation(() => new Promise(() => {}));

    const promesa = identificarProducto(IMAGEN, { presupuestoMs: 1_000 });
    const fallo = expect(promesa).rejects.toMatchObject({ tipo: "tiempo" });
    await vi.advanceTimersByTimeAsync(1_000);
    await fallo;
    expect(mocks.rerank).not.toHaveBeenCalled();
  });

  it("si el rerank cuelga, vence el plazo → tiempo", async () => {
    mocks.rerank.mockImplementation(() => new Promise(() => {}));

    const promesa = identificarProducto(IMAGEN, { presupuestoMs: 1_000 });
    const fallo = expect(promesa).rejects.toMatchObject({ tipo: "tiempo" });
    await vi.advanceTimersByTimeAsync(1_000);
    await fallo;
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

  it("ningún componente cliente importa lib/identificacion", () => {
    const raiz = resolve(__dirname, "..");
    const importadores = [resolve(raiz, "app"), resolve(raiz, "components")]
      .flatMap(archivos)
      .filter((f) => {
        const texto = readFileSync(f, "utf8");
        return /["']use client["']/.test(texto) && /lib\/identificacion\//.test(texto);
      });
    expect(importadores).toEqual([]);
  });
});
