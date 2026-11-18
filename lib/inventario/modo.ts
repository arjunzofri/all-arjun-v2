import { flagActivo } from "@/lib/feature-flags";

const MENSAJE =
  "El modo inventario nuevo está activo: las operaciones antiguas están deshabilitadas";

/** Corta las mutaciones del modo antiguo cuando el modo nuevo está encendido. */
export function exigirModoOperativo(): void {
  if (flagActivo("inventario_bodega")) throw new Error(MENSAJE);
}
