/**
 * Fase B — Módulo 1, Slice 6: Etapa C (rerank visual).
 * Sin red y sin Gemini real: fetch y llamarGeminiJson mockeados.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { geminiMock } = vi.hoisted(() => ({ geminiMock: vi.fn() }));

vi.mock("@/lib/identificacion/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/gemini")>(
    "@/lib/identificacion/gemini"
  );
  return { ...actual, llamarGeminiJson: geminiMock };
});

import type { GeminiPart } from "@/lib/identificacion/gemini";
import type { ImagenEntrada } from "@/lib/identificacion/describir";
import type { ItemCatalogo } from "@/lib/identificacion/preseleccion";
import {
  descargarMiniaturas,
  rerankPorTandas,
  rerankTanda,
} from "@/lib/identificacion/rerank";

const IMAGEN: ImagenEntrada = { data: "Zm90bw==", mimeType: "image/jpeg" };

const PROMPT = (cantidad: number, n: number) =>
  `Imagen 0 = foto de bodega de UN producto (puede estar en su caja, con poca luz). Luego vienen ${cantidad} fotos de catalogo, cada una precedida por su codigo. Elige los ${n} codigos que mas probablemente son EXACTAMENTE el mismo producto (mismo modelo y misma caja/diseno, no solo la misma categoria). Compara textos impresos, colores de la caja y forma. Devuelve SOLO JSON {"top":[{"codigo":"","confianza":0-100,"razon":""}]}`;

function item(parcial: Partial<ItemCatalogo> = {}): ItemCatalogo {
  const codigo = parcial.codigo ?? "A";
  return {
    codigo,
    codigos: [codigo],
    detalle: null,
    imagenUrl: `https://cdn.test/${codigo}.jpg`,
    ficha: null,
    ...parcial,
  };
}

function items(n: number, desde = 0): ItemCatalogo[] {
  return Array.from({ length: n }, (_, i) => item({ codigo: `C${desde + i}` }));
}

function respuestaOk() {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new TextEncoder().encode("jpeg").buffer,
  } as unknown as Response;
}

function codigosDe(parts: GeminiPart[]): string[] {
  return parts
    .filter(
      (p): p is { text: string } =>
        "text" in p && p.text.startsWith("Codigo: ")
    )
    .map((p) => p.text.slice("Codigo: ".length));
}

beforeEach(() => {
  geminiMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("descargarMiniaturas()", () => {
  it("descarga en paralelo con concurrencia máxima 12, omite fallidas y respeta el timeout", async () => {
    let activos = 0;
    let maxActivos = 0;
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      activos++;
      maxActivos = Math.max(maxActivos, activos);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activos--;
      if (url.includes("falla")) {
        return { ok: false, status: 500 } as unknown as Response;
      }
      return respuestaOk();
    });
    vi.stubGlobal("fetch", fetchMock);

    const lista = items(30).map((i) =>
      i.codigo === "C3" ? { ...i, imagenUrl: "https://cdn.test/falla.jpg" } : i
    );

    const mapa = await descargarMiniaturas(lista);

    expect(maxActivos).toBe(12);
    expect(mapa.size).toBe(29);
    expect(mapa.has("C3")).toBe(false);
    expect(mapa.get("C0")).toBe(Buffer.from("jpeg").toString("base64"));
    expect(fetchMock).toHaveBeenCalledTimes(30);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("usa la miniatura cuadrada de Cloudinary con el px indicado", async () => {
    const fetchMock = vi.fn(async () => respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await descargarMiniaturas(
      [item({ imagenUrl: "https://res.cloudinary.com/x/upload/v1/a.jpg" })],
      200
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://res.cloudinary.com/x/upload/w_200,h_200,c_pad,b_white,f_jpg,q_70/v1/a.jpg",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("rerankTanda()", () => {
  it("usa el prompt exacto, ordena partes y opciones modelo/40000; filtra y deduplica", async () => {
    geminiMock.mockResolvedValue({
      top: [
        { codigo: "B", confianza: 99, razon: "  misma caja " },
        { codigo: "Z", confianza: 100, razon: "fuera de la tanda" },
        { codigo: "A", confianza: 80, razon: "otra" },
        { codigo: "B", confianza: 70, razon: "duplicado" },
      ],
    });

    const lista = [item({ codigo: "A" }), item({ codigo: "B" })];
    const miniaturas = new Map([
      ["A", "b64A"],
      ["B", "b64B"],
    ]);

    const r = await rerankTanda(IMAGEN, lista, miniaturas);

    expect(r).toEqual([
      { codigo: "B", razon: "misma caja" },
      { codigo: "A", razon: "otra" },
    ]);
    expect(r[0]).not.toHaveProperty("confianza");

    const [parts, opciones] = geminiMock.mock.calls[0];
    expect(parts).toEqual([
      { text: PROMPT(2, 3) },
      { inline_data: { mime_type: "image/jpeg", data: "Zm90bw==" } },
      { text: "Codigo: A" },
      { inline_data: { mime_type: "image/jpeg", data: "b64A" } },
      { text: "Codigo: B" },
      { inline_data: { mime_type: "image/jpeg", data: "b64B" } },
    ]);
    expect(opciones).toEqual({ razonamiento: "modelo", timeoutMs: 40_000 });
  });

  it("omite items sin miniatura y no llama a Gemini si no queda ninguno", async () => {
    geminiMock.mockResolvedValue({ top: [] });

    const lista = [item({ codigo: "A" }), item({ codigo: "B" })];
    await rerankTanda(IMAGEN, lista, new Map([["B", "b64B"]]));

    const [parts] = geminiMock.mock.calls[0];
    expect(codigosDe(parts)).toEqual(["B"]);
    expect((parts[0] as { text: string }).text).toBe(PROMPT(1, 3));

    geminiMock.mockClear();
    await expect(rerankTanda(IMAGEN, lista, new Map())).resolves.toEqual([]);
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("respeta n y tolera top inválido", async () => {
    geminiMock.mockResolvedValue({
      top: [
        { codigo: "C0", razon: "1" },
        { codigo: "C1", razon: "2" },
        { codigo: "C2", razon: "3" },
      ],
    });

    const miniaturas = new Map([
      ["C0", "x"],
      ["C1", "x"],
      ["C2", "x"],
    ]);
    const r = await rerankTanda(IMAGEN, items(3), miniaturas, 2);

    expect(r.map((o) => o.codigo)).toEqual(["C0", "C1"]);

    geminiMock.mockResolvedValue({ top: "no-array" });
    await expect(
      rerankTanda(IMAGEN, items(1), new Map([["C0", "x"]]))
    ).resolves.toEqual([]);
  });
});

describe("rerankPorTandas()", () => {
  it("parte 48 items en 2 tandas en paralelo y hace ronda final con los 6 finalistas", async () => {
    let activos = 0;
    let maxActivos = 0;
    geminiMock.mockImplementation(async (parts: GeminiPart[]) => {
      activos++;
      maxActivos = Math.max(maxActivos, activos);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activos--;
      const codigos = codigosDe(parts);
      return {
        top: codigos.slice(0, 3).map((codigo, i) => ({
          codigo,
          confianza: 90 - i,
          razon: `r-${codigo}`,
        })),
      };
    });

    const fetchMock = vi.fn(async () => respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    const r = await rerankPorTandas(IMAGEN, items(48));

    expect(fetchMock).toHaveBeenCalledTimes(48);
    expect(maxActivos).toBe(2);
    expect(geminiMock).toHaveBeenCalledTimes(3);

    const llamadas = geminiMock.mock.calls.map((c) => codigosDe(c[0] as GeminiPart[]));
    expect(llamadas[0]).toHaveLength(24);
    expect(llamadas[1]).toHaveLength(24);
    expect(llamadas[2]).toEqual(["C0", "C1", "C2", "C24", "C25", "C26"]);

    expect(r).toEqual([
      { codigo: "C0", razon: "r-C0" },
      { codigo: "C1", razon: "r-C1" },
      { codigo: "C2", razon: "r-C2" },
    ]);
    for (const [, opciones] of geminiMock.mock.calls) {
      expect(opciones).toEqual({ razonamiento: "modelo", timeoutMs: 40_000 });
    }
  });

  it("si una tanda falla y otra responde, sigue con la que anduvo", async () => {
    geminiMock.mockImplementation(async (parts: GeminiPart[]) => {
      const codigos = codigosDe(parts);
      if (codigos.includes("C0")) throw new Error("tanda 1 caída");
      return {
        top: codigos.slice(0, 3).map((codigo) => ({ codigo, razon: "ok" })),
      };
    });
    vi.stubGlobal("fetch", vi.fn(async () => respuestaOk()));

    const r = await rerankPorTandas(IMAGEN, items(48));

    expect(r.map((o) => o.codigo)).toEqual(["C24", "C25", "C26"]);
    expect(geminiMock).toHaveBeenCalledTimes(2);
  });

  it("si todas las tandas fallan, lanza", async () => {
    geminiMock.mockRejectedValue(new Error("sin cuota"));
    vi.stubGlobal("fetch", vi.fn(async () => respuestaOk()));

    await expect(rerankPorTandas(IMAGEN, items(30))).rejects.toThrow();
  });

  it("excluye antes de armar tandas los items cuya miniatura falló", async () => {
    geminiMock.mockImplementation(async (parts: GeminiPart[]) => {
      const codigos = codigosDe(parts);
      return {
        top: codigos.slice(0, 3).map((codigo) => ({ codigo, razon: "ok" })),
      };
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("C7")
          ? ({ ok: false, status: 404 } as unknown as Response)
          : respuestaOk()
      )
    );

    await rerankPorTandas(IMAGEN, items(25));

    expect(geminiMock).toHaveBeenCalledTimes(1);
    const codigos = codigosDe(geminiMock.mock.calls[0][0] as GeminiPart[]);
    expect(codigos).toHaveLength(24);
    expect(codigos).not.toContain("C7");
  });

  it("devuelve los finalistas tal cual si no superan n y no rerankea de nuevo", async () => {
    geminiMock.mockResolvedValue({
      top: [
        { codigo: "C0", razon: "a" },
        { codigo: "C1", razon: "b" },
      ],
    });
    vi.stubGlobal("fetch", vi.fn(async () => respuestaOk()));

    const r = await rerankPorTandas(IMAGEN, items(4));

    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(r).toEqual([
      { codigo: "C0", razon: "a" },
      { codigo: "C1", razon: "b" },
    ]);
  });

  it("sin items devuelve lista vacía sin llamar a Gemini", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuestaOk()));
    geminiMock.mockResolvedValue({ top: [] });

    await expect(rerankPorTandas(IMAGEN, [])).resolves.toEqual([]);
    expect(geminiMock).not.toHaveBeenCalled();
  });
});
