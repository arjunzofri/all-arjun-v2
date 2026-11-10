/**
 * Fase B — Módulo 1, Slice 5: Etapa B (preselección).
 * Sin red y sin Gemini real: llamarGeminiJson mockeado.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { geminiMock } = vi.hoisted(() => ({ geminiMock: vi.fn() }));

vi.mock("@/lib/identificacion/gemini", async () => {
  const actual = await vi.importActual<typeof import("@/lib/identificacion/gemini")>(
    "@/lib/identificacion/gemini"
  );
  return { ...actual, llamarGeminiJson: geminiMock };
});

import type { GrupoCatalogo } from "@/lib/identificacion/catalogo";
import type { FichaVisual } from "@/lib/identificacion/fichas";
import type { ImagenEntrada, InfoFoto } from "@/lib/identificacion/describir";
import {
  armarItemsCatalogo,
  buscarPorPalabras,
  lineaCatalogo,
  preseleccionar,
  preseleccionarConModelo,
  unirCandidatos,
  type ItemCatalogo,
} from "@/lib/identificacion/preseleccion";

const IMAGEN: ImagenEntrada = { data: "Zm90bw==", mimeType: "image/jpeg" };

function info(parcial: Partial<InfoFoto> = {}): InfoFoto {
  return {
    tipo_producto_es: "",
    tipo_producto_en: "",
    marca: "",
    modelo: "",
    codigos_visibles: [],
    textos_visibles: [],
    palabras_clave: [],
    color: "",
    ...parcial,
  };
}

function ficha(parcial: Partial<FichaVisual> = {}): FichaVisual {
  return {
    tipo_es: "",
    tipo_en: "",
    colores: [],
    textos: [],
    marca: "",
    rasgos: "",
    ...parcial,
  };
}

function item(parcial: Partial<ItemCatalogo> = {}): ItemCatalogo {
  const codigo = parcial.codigo ?? "A";
  return {
    codigo,
    codigos: [codigo],
    detalle: null,
    imagenUrl: "https://cdn.test/a.jpg",
    ficha: null,
    ...parcial,
  };
}

beforeEach(() => {
  geminiMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("armarItemsCatalogo()", () => {
  it("usa la ficha del código preseleccionado o la de una variante", () => {
    const grupos: GrupoCatalogo[] = [
      { codigo: "A", codigos: ["A", "A1"], detalle: "dA", imagenUrl: "ua" },
      { codigo: "B", codigos: ["B", "B1"], detalle: "dB", imagenUrl: "ub" },
    ];
    const fA1 = ficha({ tipo_es: "variante A1" });
    const fB = ficha({ tipo_es: "ancla B" });
    const fichas = new Map([
      ["A1", { ficha: fA1 }],
      ["B", { ficha: fB }],
    ]);

    const items = armarItemsCatalogo(grupos, fichas);

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      codigo: "A",
      codigos: ["A", "A1"],
      detalle: "dA",
      imagenUrl: "ua",
      ficha: fA1,
    });
    expect(items[1].ficha).toEqual(fB);
    expect(items[1]).toMatchObject({ codigo: "B", codigos: ["B", "B1"] });
  });
});

describe("buscarPorPalabras()", () => {
  it("el modelo visible da +8 y gana", () => {
    const items = [
      item({ codigo: "A", detalle: "Producto ABC-123 original" }),
      item({ codigo: "B", detalle: "Producto XYZ" }),
    ];

    expect(buscarPorPalabras(info({ modelo: "abc-123" }), items)).toEqual(["A"]);
  });

  it("los textos de la ficha dan +2", () => {
    const items = [
      item({ codigo: "A", ficha: ficha({ textos: ["Bluetooth 5.3"] }) }),
      item({ codigo: "B", ficha: ficha({ textos: ["Otra cosa"] }) }),
    ];

    expect(buscarPorPalabras(info({ textos_visibles: ["BLUETOOTH"] }), items)).toEqual([
      "A",
    ]);
  });

  it("una variante del grupo matchea por su código alterno", () => {
    const items = [
      item({ codigo: "VD-QAN-2414", codigos: ["VD-QAN-2414", "QAN-2414"] }),
      item({ codigo: "OTRO", codigos: ["OTRO"] }),
    ];

    expect(buscarPorPalabras(info({ codigos_visibles: ["QAN-2414"] }), items)).toEqual([
      "VD-QAN-2414",
    ]);
  });

  it("respeta el parámetro n", () => {
    const items = ["A", "B", "C"].map((c) =>
      item({ codigo: c, detalle: `producto ${c}` })
    );
    expect(buscarPorPalabras(info({ palabras_clave: ["producto"] }), items, 2)).toHaveLength(2);
  });
});

describe("lineaCatalogo()", () => {
  it("arma el LIST de la PoC y quita textos genéricos de código/caja", () => {
    const linea = lineaCatalogo(
      item({
        codigo: "A",
        detalle: "  Foo   Bar ",
        ficha: ficha({
          tipo_es: "audifonos",
          colores: ["negro", "rojo"],
          textos: ["Código 123", "Bluetooth", "X CAJA"],
        }),
      })
    );

    expect(linea).toBe("A | Foo Bar | audifonos; negro/rojo; Bluetooth");
  });

  it("tolera detalle y ficha nulos", () => {
    expect(lineaCatalogo(item({ codigo: "A" }))).toBe("A |  | ; ; ");
  });
});

describe("unirCandidatos()", () => {
  it("pone llm primero, deduplica y aplica cap", () => {
    expect(unirCandidatos(["B", "A"], ["A", "C"])).toEqual(["B", "A", "C"]);

    const llm = Array.from({ length: 60 }, (_, i) => `L${i}`);
    const unidos = unirCandidatos(llm, ["K1", "K2"]);
    expect(unidos).toHaveLength(48);
    expect(unidos[0]).toBe("L0");
    expect(unidos).not.toContain("K1");
  });
});

describe("preseleccionarConModelo()", () => {
  it("usa prompt B con LIST + descripción, opciones low/25000 y mapea variante→grupo", async () => {
    const items = [
      item({ codigo: "GRUPO", codigos: ["GRUPO", "VARIANTE"] }),
      item({ codigo: "OTRO", codigos: ["OTRO"] }),
    ];
    geminiMock.mockResolvedValue({
      candidatos: ["VARIANTE", "NO-EXISTE", "OTRO", "GRUPO", "VARIANTE"],
    });

    const codigos = await preseleccionarConModelo(IMAGEN, info({ marca: "ACME" }), items);

    expect(codigos).toEqual(["GRUPO", "OTRO"]);

    const [parts, opciones] = geminiMock.mock.calls[0];
    const texto = (parts[0] as { text: string }).text;
    expect(texto).toContain("Catalogo (codigo | descripcion | ficha visual");
    expect(texto).toContain(lineaCatalogo(items[0]));
    expect(texto).toContain('"marca":"ACME"');
    expect(texto).toContain("30 codigos mas probables");
    expect(parts[1]).toEqual({
      inline_data: { mime_type: "image/jpeg", data: "Zm90bw==" },
    });
    expect(opciones).toEqual({ razonamiento: "low", timeoutMs: 25_000 });
  });
});

describe("preseleccionar()", () => {
  it("une llm primero y kw después", async () => {
    const items = [item({ codigo: "A", detalle: "producto" }), item({ codigo: "B", detalle: "producto" })];
    geminiMock.mockResolvedValue({ candidatos: ["B"] });

    const r = await preseleccionar(IMAGEN, info({ palabras_clave: ["producto"] }), items);

    expect(r.llm).toEqual(["B"]);
    expect(r.kw).toEqual(["A", "B"]);
    expect(r.candidatos).toEqual(["B", "A"]);
    expect(r.errorModelo).toBeUndefined();
  });

  it("si el modelo falla sigue solo con kw y lo informa", async () => {
    const items = [item({ codigo: "A", detalle: "producto" })];
    geminiMock.mockRejectedValue(new Error("sin cuota"));

    const r = await preseleccionar(IMAGEN, info({ palabras_clave: ["producto"] }), items);

    expect(r.llm).toEqual([]);
    expect(r.kw).toEqual(["A"]);
    expect(r.candidatos).toEqual(["A"]);
    expect(r.errorModelo).toContain("sin cuota");
  });
});
