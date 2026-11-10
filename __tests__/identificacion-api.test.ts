/**
 * Fase B — Módulo 1, Slice 7: POST /api/identificacion.
 * Auth, flag y orquestador mockeados: nada real.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const state = vi.hoisted(() => ({ flag: false }));

const h = vi.hoisted(() => {
  class ErrorIdentificacion extends Error {
    readonly tipo: "tiempo" | "ia" | "foto";
    constructor(tipo: "tiempo" | "ia" | "foto", mensaje: string) {
      super(mensaje);
      this.name = "ErrorIdentificacion";
      this.tipo = tipo;
    }
  }
  return { identificarProducto: vi.fn(), ErrorIdentificacion };
});

vi.mock("@/lib/feature-flags", () => ({
  flagActivo: (key: string) => key === "identificacion_foto" && state.flag,
}));
vi.mock("@/lib/identificacion/identificar", () => h);

import { auth } from "@/lib/auth";
import {
  POST,
  dynamic,
  maxDuration,
  runtime,
} from "@/app/api/identificacion/route";

const mockAuth = vi.mocked(auth);
const mockIdentificar = vi.mocked(h.identificarProducto);

const SESION = { user: { id: "2", role: "operador" } } as never;

const RESULTADO = {
  opciones: [
    {
      codigo: "A",
      codigos: ["A"],
      detalle: "d",
      imagenUrl: "https://cdn.test/A.jpg",
      razon: "r",
    },
  ],
  tiempos: {
    catalogoMs: 1,
    describirMs: 2,
    preseleccionMs: 3,
    rerankMs: 4,
    totalMs: 10,
  },
  candidatos: 1,
  avisos: [],
};

const BODY = { data: "Zm90bw==", mimeType: "image/jpeg" };

function req(body: unknown = BODY): Request {
  return new Request("https://app-arjun.local/api/identificacion", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.flag = true;
  mockAuth.mockResolvedValue(SESION);
  mockIdentificar.mockResolvedValue(RESULTADO as never);
});

describe("controles de acceso", () => {
  it("sin sesión → 401 JSON (aunque el flag esté apagado)", async () => {
    mockAuth.mockResolvedValue(null as never);
    state.flag = false;

    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No autorizado" });
  });

  it("flag apagado → 404", async () => {
    state.flag = false;
    const res = await POST(req());
    expect(res.status).toBe(404);
  });

  it("cualquier rol puede usarlo", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
  });
});

describe("validación del body", () => {
  it("JSON inválido → 400 Imagen invalida", async () => {
    const res = await POST(req("{no es json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Imagen invalida" });
  });

  it("mimeType no permitido → 400", async () => {
    const res = await POST(req({ ...BODY, mimeType: "image/gif" }));
    expect(res.status).toBe(400);
  });

  it("base64 inválido → 400", async () => {
    const res = await POST(req({ ...BODY, data: "no es base64!" }));
    expect(res.status).toBe(400);
  });

  it("data mayor a 1.5 MB → 413", async () => {
    const res = await POST(req({ ...BODY, data: "A".repeat(1_500_001) }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "La foto es demasiado grande" });
  });
});

describe("respuestas del orquestador", () => {
  it("200 con ResultadoIdentificacion", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESULTADO);
    expect(mockIdentificar).toHaveBeenCalledWith(BODY);
  });

  it("tiempo → 504", async () => {
    mockIdentificar.mockRejectedValue(
      new h.ErrorIdentificacion("tiempo", "se acabo")
    );
    const res = await POST(req());
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: "La identificacion tardo demasiado. Intenta de nuevo.",
    });
  });

  it("foto → 422", async () => {
    mockIdentificar.mockRejectedValue(
      new h.ErrorIdentificacion("foto", "no se pudo")
    );
    const res = await POST(req());
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error:
        "No se pudo reconocer un producto en la foto. Intenta con otra foto.",
    });
  });

  it("ia → 502 y nunca devuelve el mensaje crudo", async () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    mockIdentificar.mockRejectedValue(
      new h.ErrorIdentificacion("ia", "GEMINI-SECRETO-500")
    );

    const res = await POST(req());
    const texto = JSON.stringify(await res.json());

    expect(res.status).toBe(502);
    expect(texto).not.toContain("GEMINI-SECRETO");
    expect(texto).toContain("El servicio de identificacion no respondio");
    espia.mockRestore();
  });

  it("error inesperado → 502", async () => {
    mockIdentificar.mockRejectedValue(new Error("boom"));
    const res = await POST(req());
    expect(res.status).toBe(502);
  });
});

describe("configuración de la ruta", () => {
  it("dynamic force-dynamic, runtime nodejs, maxDuration 60", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });
});
