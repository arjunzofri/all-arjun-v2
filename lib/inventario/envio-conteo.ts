import type { BorradorConteo } from "./borradores-conteo";
import type { ConteoDTO, RegistrarConteoInput, RegistrarConteoRespuesta } from "./contratos";
import { prepararConteo } from "./formulario-conteo";
import type { UbicacionInventario } from "./ubicaciones";

export const MENSAJE_ERROR_ENVIO = "No se pudo guardar el conteo. Intenta nuevamente.";
export const MENSAJE_BORRADOR_INVALIDO = "No se pudo preparar el conteo. Revisa la cantidad e intenta nuevamente.";

export type VigenteEnvio = { id: number; cantidad: number; creadoEn: string } | null;

export type ResultadoEnvio =
  | { tipo: "exito"; conteo: ConteoDTO; repetido: boolean; cantidad: number; nonce: string }
  | { tipo: "conflicto"; vigente: VigenteEnvio; propuesta: number; nonce: string }
  | { tipo: "error"; mensaje: string; nonce: string }
  | { tipo: "invalido"; mensaje: string }
  | { tipo: "ocupado" };

export type ControladorEnvio = {
  enviar(borrador: BorradorConteo): Promise<ResultadoEnvio>;
  readonly ocupado: boolean;
};

export function crearEnvioConteo(deps: {
  accion: (input: RegistrarConteoInput) => Promise<RegistrarConteoRespuesta>;
  descartar: (productoId: number, ubicacion: UbicacionInventario, nonce: string) => void;
}): ControladorEnvio {
  let ocupado = false;
  return {
    get ocupado() { return ocupado; },
    async enviar(borrador) {
      if (ocupado) return { tipo: "ocupado" };
      const payload = prepararConteo(borrador);
      if (!payload) return { tipo: "invalido", mensaje: MENSAJE_BORRADOR_INVALIDO };
      ocupado = true;
      try {
        const r = await deps.accion(payload);
        if (r.ok) {
          deps.descartar(payload.productoId, payload.ubicacion, payload.idempotencyKey);
          return { tipo: "exito", conteo: r.conteo, repetido: r.repetido, cantidad: payload.cantidad, nonce: payload.idempotencyKey };
        }
        if ("conflicto" in r) {
          const v = r.vigente;
          return { tipo: "conflicto", vigente: v && { id: v.id, cantidad: v.cantidad, creadoEn: v.creadoEn }, propuesta: payload.cantidad, nonce: payload.idempotencyKey };
        }
        return { tipo: "error", mensaje: MENSAJE_ERROR_ENVIO, nonce: payload.idempotencyKey };
      } catch {
        return { tipo: "error", mensaje: MENSAJE_ERROR_ENVIO, nonce: payload.idempotencyKey };
      } finally {
        ocupado = false;
      }
    },
  };
}
