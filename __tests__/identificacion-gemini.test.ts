/**
 * Fase B — Módulo 1, Slice 1: cliente Gemini JSON.
 * T1–T13 del contrato + T14 (rotación en 401/403, ajuste R3).
 * Ningún test llama a la API real salvo T12 con GEMINI_REAL=1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const CLAVES = ["GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"];
const MODELO = "gemini-3.5-flash-lite";
const URL_GEMINI = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

type Modulo = typeof import("@/lib/identificacion/gemini");

async function cargar(): Promise<Modulo> {
  vi.resetModules(); // el cursor de claves es de módulo
  return import("@/lib/identificacion/gemini");
}

function ponerClaves(...claves: string[]) {
  CLAVES.forEach((nombre, i) => {
    process.env[nombre] = claves[i] ?? "";
  });
}

function borrarClaves() {
  CLAVES.forEach((nombre) => delete process.env[nombre]);
}

function respuestaTexto(texto: string, finishReason?: string) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: texto }] },
          ...(finishReason ? { finishReason } : {}),
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

function respuestaEstado(status: number, mensaje = "error") {
  return new Response(JSON.stringify({ error: { message: mensaje } }), { status });
}

function stubFetch(...respuestas: Response[]) {
  const fn = vi.fn();
  respuestas.forEach((r) => fn.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function claveDe(fn: ReturnType<typeof stubFetch>, i: number): string | null {
  const init = fn.mock.calls[i]?.[1] as RequestInit | undefined;
  return new Headers(init?.headers as HeadersInit).get("x-goog-api-key");
}

function bodyDe(fn: ReturnType<typeof stubFetch>, i = 0): string {
  const init = fn.mock.calls[i]?.[1] as RequestInit | undefined;
  return String(init?.body ?? "");
}

async function capturarError(promesa: Promise<unknown>): Promise<Error & { status?: number | null; intentos?: number }> {
  try {
    await promesa;
  } catch (e) {
    return e as Error & { status?: number | null; intentos?: number };
  }
  throw new Error("La promesa debía rechazar");
}

let envGuardado: Record<string, string | undefined>;

beforeEach(() => {
  envGuardado = Object.fromEntries(CLAVES.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const k of CLAVES) {
    if (envGuardado[k] === undefined) delete process.env[k];
    else process.env[k] = envGuardado[k];
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("llamarGeminiJson() — T1–T4", () => {
  it("T1: sin claves lanza GeminiError que nombra GEMINI_API_KEY", async () => {
    const { llamarGeminiJson, GeminiError } = await cargar();
    borrarClaves();

    const err = await capturarError(llamarGeminiJson([{ text: "hola" }]));

    expect(err).toBeInstanceOf(GeminiError);
    expect(err.message).toContain("GEMINI_API_KEY");
    expect(err.status).toBeNull();
    expect(err.intentos).toBe(0);
  });

  it("T2: happy path devuelve el JSON parseado", async () => {
    const { llamarGeminiJson } = await cargar();
    ponerClaves("k1", "k2", "k3");
    stubFetch(respuestaTexto('{"ok":true}'));

    await expect(llamarGeminiJson([{ text: "responde" }])).resolves.toEqual({ ok: true });
  });

  it("T3: body y URL usan el modelo y generationConfig exactos", async () => {
    const { llamarGeminiJson } = await cargar();
    ponerClaves("k1");
    const fn = stubFetch(respuestaTexto('{"ok":true}'));
    const parts = [{ text: "responde" }];

    await llamarGeminiJson(parts);

    expect(fn.mock.calls[0][0]).toBe(URL_GEMINI);
    expect(String(fn.mock.calls[0][0])).not.toContain("key=");
    const body = JSON.parse(bodyDe(fn));
    expect(body.contents).toEqual([{ role: "user", parts }]);
    expect(body.generationConfig).toEqual({
      temperature: 0,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "low" },
    });
  });

  it("T4: envía las parts intactas (text e inline_data)", async () => {
    const { llamarGeminiJson } = await cargar();
    ponerClaves("k1");
    const fn = stubFetch(respuestaTexto('{"ok":true}'));
    const parts = [
      { text: "describe la foto" },
      { inline_data: { mime_type: "image/jpeg", data: "Zm90bw==" } },
    ];

    await llamarGeminiJson(parts);

    expect(JSON.parse(bodyDe(fn)).contents[0].parts).toEqual(parts);
  });
});

describe("llamarGeminiJson() — rotación y reintentos", () => {
  it("T5: 429 en clave 1 → reintenta con clave 2 y devuelve success", async () => {
    const { llamarGeminiJson } = await cargar();
    ponerClaves("k1", "k2", "k3");
    const fn = stubFetch(respuestaEstado(429), respuestaTexto('{"ok":true}'));

    vi.useFakeTimers();
    const promesa = llamarGeminiJson([{ text: "responde" }]);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(promesa).resolves.toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(claveDe(fn, 0)).not.toBe(claveDe(fn, 1));
  });

  it("T6: 500 en claves 1 y 2 → clave 3 success", async () => {
    const { llamarGeminiJson } = await cargar();
    ponerClaves("k1", "k2", "k3");
    const fn = stubFetch(respuestaEstado(500), respuestaEstado(502), respuestaTexto('{"ok":true}'));

    vi.useFakeTimers();
    const promesa = llamarGeminiJson([{ text: "responde" }]);
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(promesa).resolves.toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
    expect([claveDe(fn, 0), claveDe(fn, 1), claveDe(fn, 2)]).toEqual(["k1", "k2", "k3"]);
  });

  it("T7: 3 claves en 429 → exactamente 6 intentos y lanza con status 429", async () => {
    const { llamarGeminiJson, GeminiError } = await cargar();
    ponerClaves("k1", "k2", "k3");
    const fn = stubFetch(...Array.from({ length: 6 }, () => respuestaEstado(429)));

    vi.useFakeTimers();
    const p = capturarError(llamarGeminiJson<unknown>([{ text: "responde" }]));
    await vi.advanceTimersByTimeAsync(10_000);
    const err = await p;

    expect(fn).toHaveBeenCalledTimes(6);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.status).toBe(429);
    expect(err.intentos).toBe(6);
  });

  it("T8: 400 y 404 no reintentan (1 solo intento) y lanzan con su status", async () => {
    for (const status of [400, 404]) {
      const { llamarGeminiJson, GeminiError } = await cargar();
      ponerClaves("k1", "k2", "k3");
      const fn = stubFetch(respuestaEstado(status));

      const err = await capturarError(llamarGeminiJson([{ text: "responde" }]));

      expect(fn).toHaveBeenCalledTimes(1);
      expect(err).toBeInstanceOf(GeminiError);
      expect(err.status).toBe(status);
    }
  });

  it("T14: 401/403 rota a la siguiente clave y devuelve success", async () => {
    for (const status of [401, 403]) {
      const { llamarGeminiJson } = await cargar();
      ponerClaves("k1", "k2", "k3");
      const fn = stubFetch(respuestaEstado(status), respuestaTexto('{"ok":true}'));

      await expect(llamarGeminiJson([{ text: "responde" }])).resolves.toEqual({ ok: true });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(claveDe(fn, 0)).not.toBe(claveDe(fn, 1));
    }
  });
});

describe("llamarGeminiJson() — parseo defensivo", () => {
  it("T9: limpia ```json … ``` y parsea igual", async () => {
    const { llamarGeminiJson } = await cargar();
    ponerClaves("k1");
    stubFetch(respuestaTexto('```json\n{"ok":true}\n```'));

    await expect(llamarGeminiJson([{ text: "responde" }])).resolves.toEqual({ ok: true });
  });

  it("T10: texto no-JSON lanza GeminiError con el fragmento y 1 solo intento", async () => {
    const { llamarGeminiJson, GeminiError } = await cargar();
    ponerClaves("k1");
    const fn = stubFetch(respuestaTexto("esto no es json"));

    const err = await capturarError(llamarGeminiJson([{ text: "responde" }]));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(err).toBeInstanceOf(GeminiError);
    expect(err.message).toContain("JSON");
    expect(err.message).toContain("esto no es json");
  });

  it("T11: candidates vacío o finishReason SAFETY → error sin reintento", async () => {
    const { llamarGeminiJson, GeminiError } = await cargar();
    ponerClaves("k1");

    const vacio = stubFetch(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    const errVacio = await capturarError(llamarGeminiJson([{ text: "responde" }]));
    expect(vacio).toHaveBeenCalledTimes(1);
    expect(errVacio).toBeInstanceOf(GeminiError);
    expect(errVacio.message).toContain("bloqueada o vacía");

    vi.unstubAllGlobals();
    const safety = stubFetch(respuestaTexto('{"ok":true}', "SAFETY"));
    const errSafety = await capturarError(llamarGeminiJson([{ text: "responde" }]));
    expect(safety).toHaveBeenCalledTimes(1);
    expect(errSafety).toBeInstanceOf(GeminiError);
    expect(errSafety.message).toContain("SAFETY");
  });
});

describe("T12 — integración real (opt-in)", () => {
  const correr = process.env.GEMINI_REAL === "1" ? it : it.skip;

  correr(
    "T12: modelo/thinkingLevel reales responden JSON",
    async () => {
      const { llamarGeminiJson } = await cargar();
      // PNG 1x1 transparente
      const png =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

      const r = await llamarGeminiJson<{ ok: boolean }>([
        { text: 'Responde exactamente con este JSON: {"ok":true}' },
        { inline_data: { mime_type: "image/png", data: png } },
      ]);

      expect(r.ok).toBe(true);
    },
    60_000
  );
});

describe("T13 — guarda estática contra fuga al cliente", () => {
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

  it("gemini.ts no declara 'use client' y ninguna UI lo importa", () => {
    const raiz = resolve(__dirname, "..");
    const fuente = readFileSync(resolve(raiz, "lib/identificacion/gemini.ts"), "utf8");
    expect(fuente).not.toMatch(/["']use client["']/);

    const importadores = [
      resolve(raiz, "app/(dashboard)"),
      resolve(raiz, "components"),
    ]
      .flatMap(archivos)
      .filter((f) => /lib\/identificacion\/gemini/.test(readFileSync(f, "utf8")));

    expect(importadores).toEqual([]);
  });
});
