export type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

export class GeminiError extends Error {
  readonly status: number | null; // null = error de formato/config/red local
  readonly intentos: number;

  constructor(message: string, status: number | null = null, intentos = 0) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.intentos = intentos;
  }
}

export const MODELO_GEMINI = "gemini-3.5-flash-lite";
const URL_GEMINI = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent`;
const TIMEOUT_MS = 20_000;
const MAX_CUERPO_ERROR = 300;
const MAX_TEXTO_JSON = 200;

// Cursor de módulo: llamadas concurrentes no arrancan siempre en la clave 1.
let cursor = 0;

type RespuestaGemini = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
};

function leerClaves(): string[] {
  return [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ]
    .map((clave) => clave?.trim())
    .filter((clave): clave is string => Boolean(clave));
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textoDe(respuesta: RespuestaGemini, intento: number): string {
  const candidato = respuesta.candidates?.[0];
  const finish = candidato?.finishReason;
  const texto = (candidato?.content?.parts ?? [])
    .map((parte) => parte.text ?? "")
    .join("");

  if (!texto || finish === "SAFETY" || finish === "RECITATION") {
    throw new GeminiError(
      `Respuesta bloqueada o vacía: ${finish ?? "sin texto"}`,
      null,
      intento
    );
  }
  return texto;
}

function parsearJson<T>(texto: string, intento: number): T {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(limpio) as T;
  } catch {
    throw new GeminiError(
      `Respuesta no es JSON válido: ${texto.slice(0, MAX_TEXTO_JSON)}`,
      null,
      intento
    );
  }
}

/**
 * POST a Gemini con rotación de claves y reintentos en 429/5xx.
 * 401/403 rotan a la siguiente clave (una clave mala no tumba la llamada).
 * 400/404 se lanzan de inmediato. Clave en header, nunca en la URL.
 */
export interface OpcionesGemini {
  /** "low" (default) envía thinkingLevel low; "modelo" omite thinkingConfig. */
  razonamiento?: "low" | "modelo";
  timeoutMs?: number;
}

export async function llamarGeminiJson<T>(
  parts: GeminiPart[],
  opciones: OpcionesGemini = {}
): Promise<T> {
  const claves = leerClaves();
  if (claves.length === 0) {
    throw new GeminiError("Sin claves GEMINI_API_KEY_*", null, 0);
  }

  const inicio = cursor++;
  const maxIntentos = claves.length * 2;
  let ultimoStatus: number | null = null;
  let ultimoCuerpo = "";

  for (let intento = 1; intento <= maxIntentos; intento++) {
    const clave = claves[(inicio + intento - 1) % claves.length];

    let respuesta: Response;
    try {
      respuesta = await fetch(URL_GEMINI, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": clave,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            ...(opciones.razonamiento === "modelo"
              ? {}
              : { thinkingConfig: { thinkingLevel: "low" } }),
          },
        }),
        signal: AbortSignal.timeout(opciones.timeoutMs ?? TIMEOUT_MS),
      });
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      throw new GeminiError(
        `Error de red o timeout: ${motivo.slice(0, MAX_CUERPO_ERROR)}`,
        null,
        intento
      );
    }

    if (respuesta.ok) {
      const cuerpo = (await respuesta.json()) as RespuestaGemini;
      return parsearJson<T>(textoDe(cuerpo, intento), intento);
    }

    ultimoStatus = respuesta.status;
    ultimoCuerpo = (await respuesta.text()).slice(0, MAX_CUERPO_ERROR);

    // Clave inválida: probar la siguiente sin backoff.
    if (respuesta.status === 401 || respuesta.status === 403) continue;

    if (respuesta.status === 429 || respuesta.status >= 500) {
      if (intento < maxIntentos) {
        await esperar(Math.min(250 * 2 ** (intento - 1), 2_000));
      }
      continue;
    }

    throw new GeminiError(
      `Gemini HTTP ${respuesta.status}: ${ultimoCuerpo}`,
      respuesta.status,
      intento
    );
  }

  throw new GeminiError(
    `Gemini HTTP ${ultimoStatus}: ${ultimoCuerpo}`,
    ultimoStatus,
    maxIntentos
  );
}
