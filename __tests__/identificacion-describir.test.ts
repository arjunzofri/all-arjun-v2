/**
 * Fase B — Módulo 1, Slice 4: Etapa A (describir foto).
 * Sin red y sin Gemini real: llamarGeminiJson mockeado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const { geminiMock } = vi.hoisted(() => ({ geminiMock: vi.fn() }));

vi.mock("@/lib/identificacion/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/gemini")>(
    "@/lib/identificacion/gemini"
  );
  return { ...actual, llamarGeminiJson: geminiMock };
});

import {
  describirFoto,
  parteImagen,
  type ImagenEntrada,
  type InfoFoto,
} from "@/lib/identificacion/describir";

const PROMPT_A =
  'Foto tomada con celular en una bodega de un producto importado (en su caja). Devuelve SOLO JSON: {"tipo_producto_es":"","tipo_producto_en":"","marca":"","modelo":"","codigos_visibles":[],"textos_visibles":[],"palabras_clave":["8-15 palabras en espanol e ingles para buscar en un catalogo"],"color":""}. Transcribe textos tal cual aparecen; no inventes.';

const IMAGEN: ImagenEntrada = { data: "Zm90bw==", mimeType: "image/jpeg" };

const INFO: InfoFoto = {
  tipo_producto_es: "audífonos",
  tipo_producto_en: "headphones",
  marca: "ACME",
  modelo: "BT-5",
  codigos_visibles: ["BT-5"],
  textos_visibles: ["Bluetooth"],
  palabras_clave: ["audífonos", "headphones"],
  color: "negro",
};

beforeEach(() => {
  geminiMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parteImagen()", () => {
  it("arma la parte inline_data con el mimeType y la data tal cual", () => {
    expect(parteImagen(IMAGEN)).toEqual({
      inline_data: { mime_type: "image/jpeg", data: "Zm90bw==" },
    });
  });
});

describe("describirFoto()", () => {
  it("usa el prompt A exacto, la imagen después y opciones low/15000", async () => {
    geminiMock.mockResolvedValue(INFO);

    await expect(describirFoto(IMAGEN)).resolves.toEqual(INFO);

    const [parts, opciones] = geminiMock.mock.calls[0];
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ text: PROMPT_A });
    expect(parts[1]).toEqual({
      inline_data: { mime_type: "image/jpeg", data: "Zm90bw==" },
    });
    expect(opciones).toEqual({ razonamiento: "low", timeoutMs: 15_000 });
  });

  it("normaliza nulls, tipos raros, espacios y recorta arrays", async () => {
    geminiMock.mockResolvedValue({
      tipo_producto_es: "  audífonos ",
      tipo_producto_en: 42,
      marca: null,
      modelo: undefined,
      codigos_visibles: ["  BT-5 ", 7, "", null, "X1"],
      textos_visibles: Array.from({ length: 20 }, (_, i) => ` t${i} `),
      palabras_clave: [...Array.from({ length: 20 }, (_, i) => `k${i}`), 3, ""],
      color: " negro ",
    });

    const info = await describirFoto(IMAGEN);

    expect(info.tipo_producto_es).toBe("audífonos");
    expect(info.tipo_producto_en).toBe("");
    expect(info.marca).toBe("");
    expect(info.modelo).toBe("");
    expect(info.codigos_visibles).toEqual(["BT-5", "X1"]);
    expect(info.color).toBe("negro");
    expect(info.textos_visibles).toHaveLength(12);
    expect(info.textos_visibles[0]).toBe("t0");
    expect(info.palabras_clave).toHaveLength(15);
  });

  it("lanza error si no hay tipo de producto ni en español ni en inglés", async () => {
    geminiMock.mockResolvedValue({
      tipo_producto_es: "  ",
      tipo_producto_en: null,
      marca: "ACME",
    });

    await expect(describirFoto(IMAGEN)).rejects.toThrow("No se pudo describir la foto");
  });

  it("lanza el mismo error si la respuesta no es un objeto válido", async () => {
    geminiMock.mockResolvedValue("no es un objeto");
    await expect(describirFoto(IMAGEN)).rejects.toThrow("No se pudo describir la foto");

    geminiMock.mockResolvedValue(null);
    await expect(describirFoto(IMAGEN)).rejects.toThrow("No se pudo describir la foto");
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

  it("ningún archivo de app/ o components/ importa lib/identificacion", () => {
    const raiz = resolve(__dirname, "..");
    const importadores = [resolve(raiz, "app"), resolve(raiz, "components")]
      .flatMap(archivos)
      .filter((f) => /lib\/identificacion\//.test(readFileSync(f, "utf8")));
    expect(importadores).toEqual([]);
  });
});
