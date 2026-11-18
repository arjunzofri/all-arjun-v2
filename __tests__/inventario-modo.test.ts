/**
 * Fase B — inv-05: apagado reversible (R9) y overrides server-only de flags.
 * ROJO esperado: no existe lib/inventario/modo.ts y flagActivo ignora overrides.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const estado = vi.hoisted(() => ({
  flags: { inventario_bodega: false, identificacion_foto: true } as Record<string, unknown>,
}));
// Constructor de Neon aislado: si la guarda funciona, nunca se llama.
const neonMock = vi.hoisted(() => vi.fn(() => vi.fn(async () => [])));

vi.mock("@/config/feature-flags.json", () => ({ default: estado.flags }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("@/db", () => ({ db: {} }));

import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { crearEntrada } from "@/lib/actions/entradas";
import { crearSalida } from "@/lib/actions/salidas";
import { crearRetorno } from "@/lib/actions/retornos";
import { transferirEntreBodegas } from "@/lib/actions/transferencias";
import { crearAjuste } from "@/lib/actions/ajustes";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const ENV = "FEATURE_INVENTARIO_BODEGA";
const MENSAJE =
  "El modo inventario nuevo está activo: las operaciones antiguas están deshabilitadas";

type Accion = (input: never) => Promise<unknown>;
const ACCIONES: Array<[string, Accion, Record<string, unknown>]> = [
  ["crearEntrada", crearEntrada, { codigo: "X", cantidad: 1, bodegaId: 1, idempotencyKey: "b" }],
  ["crearSalida", crearSalida, { codigo: "X", cantidad: 1, bodegaOrigenId: 1, moduloDestinoId: 1, idempotencyKey: "b" }],
  ["crearRetorno", crearRetorno, { codigo: "X", cantidad: 1, moduloOrigenId: 1, bodegaDestinoId: 1, idempotencyKey: "b" }],
  ["transferirEntreBodegas", transferirEntreBodegas, { codigo: "X", cantidad: 1, bodegaOrigenId: 1, bodegaDestinoId: 2, idempotencyKey: "b" }],
  ["crearAjuste", crearAjuste, { movimientoOriginalId: 1, cantidadReal: 1, idempotencyKey: "b" }],
];

async function guard() {
  const mod = await import("@/lib/inventario/modo");
  return mod.exigirModoOperativo;
}

function limpiarEnv() {
  delete process.env[ENV];
  delete process.env.FEATURE_IDENTIFICACION_FOTO;
  delete process.env.FEATURE_TOSTRING;
}

beforeEach(() => {
  estado.flags.inventario_bodega = false;
  estado.flags.identificacion_foto = true;
  limpiarEnv();
  mockAuth.mockResolvedValue({ user: { id: "62" } });
  neonMock.mockClear();
});
afterEach(limpiarEnv);

describe("flagActivo() — overrides de entorno", () => {
  it("sin env conserva el JSON y env exacto true/false lo pisa", () => {
    expect(flagActivo("inventario_bodega")).toBe(false);
    process.env[ENV] = "true";
    expect(flagActivo("inventario_bodega")).toBe(true);
    process.env.FEATURE_IDENTIFICACION_FOTO = "false";
    expect(flagActivo("identificacion_foto")).toBe(false);
  });
  it("valores inválidos caen al JSON", () => {
    estado.flags.inventario_bodega = true;
    for (const valor of ["1", "TRUE", " true", "yes", ""]) {
      process.env[ENV] = valor;
      expect(flagActivo("inventario_bodega")).toBe(true);
    }
    process.env[ENV] = "false";
    expect(flagActivo("inventario_bodega")).toBe(false);
  });
  it("una clave desconocida nunca enciende (ni toString)", () => {
    process.env[ENV] = "true";
    process.env.FEATURE_TOSTRING = "true";
    // @ts-expect-error — clave fuera de config/feature-flags.json
    expect(flagActivo("toString")).toBe(false);
  });
});

describe("exigirModoOperativo()", () => {
  it("lanza el error fijo en español con el flag activo", async () => {
    process.env[ENV] = "true";
    const exigir = await guard();
    expect(() => exigir()).toThrow(MENSAJE);
  });
  it("no lanza con el flag apagado", async () => {
    const exigir = await guard();
    expect(() => exigir()).not.toThrow();
  });
});

describe("acciones antiguas — guarda tras auth y antes de DB", () => {
  it.each(ACCIONES)("%s con flag true rechaza sin tocar Neon", async (_n, accion, input) => {
    process.env[ENV] = "true";
    await expect(accion(input as never)).rejects.toThrow(MENSAJE);
    expect(neonMock).not.toHaveBeenCalled();
  });
  it.each(ACCIONES)("%s anónimo conserva el rechazo de auth", async (_n, accion, input) => {
    process.env[ENV] = "true";
    mockAuth.mockResolvedValueOnce(null);
    await expect(accion(input as never)).rejects.toThrow("No autenticado");
    expect(neonMock).not.toHaveBeenCalled();
  });
  it("con flag false no bloquea y sigue el flujo anterior", async () => {
    await expect(
      crearEntrada({ codigo: "X", cantidad: 1, bodegaId: 1, idempotencyKey: "b" })
    ).rejects.toThrow("Bodega no encontrada");
    expect(neonMock).toHaveBeenCalled();
  });
});
