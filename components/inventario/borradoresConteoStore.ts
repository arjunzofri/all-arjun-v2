import { claveBorrador, descartarBorrador, esBorradorValido, guardarCantidadTexto, type BorradorConteo, type BorradoresConteo, type EntradaBorrador } from "@/lib/inventario/borradores-conteo";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";

export type IdUsuario = string | number | null | undefined;
export const BORRADORES_VACIOS: BorradoresConteo = {}; // snapshot SSR/empty estable

// ponytail: store de módulo por pestaña; la clave incluye el userId.
const PREFIJO = "inventario.borradores-conteo.v1.";
const memoria = new Map<string, BorradoresConteo>();
const tokens = new Map<string, number>();
const oyentes = new Map<string, Set<() => void>>();
const normalizar = (id: IdUsuario): string => (id === null || id === undefined ? "" : String(id).trim());
const clave = (id: string): string => PREFIJO + id;
const leerStorage = (): Storage | null => { try { return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null; } catch { return null; } };
const notificar = (id: string): void => { for (const o of oyentes.get(id) ?? []) o(); };
const sanear = (raiz: unknown): BorradoresConteo => {
  if (!raiz || typeof raiz !== "object" || Array.isArray(raiz)) return BORRADORES_VACIOS;
  const salida: BorradoresConteo = {};
  for (const k of Object.keys(raiz)) {
    const v = (raiz as Record<string, unknown>)[k];
    if (!esBorradorValido(v) || k !== claveBorrador(v.productoId, v.ubicacion)) continue;
    salida[k] = { productoId: v.productoId, ubicacion: { ...v.ubicacion }, cantidadTexto: v.cantidadTexto, expectedConteoId: v.expectedConteoId, nonce: v.nonce, actualizadoEn: v.actualizadoEn };
  }
  return Object.keys(salida).length ? salida : BORRADORES_VACIOS;
};
const cargar = (id: string): BorradoresConteo => { try { return sanear(JSON.parse(leerStorage()?.getItem(clave(id)) ?? "null")); } catch { return BORRADORES_VACIOS; } };
const persistir = (id: string, mapa: BorradoresConteo): void => {
  try { const s = leerStorage(); if (s) { if (Object.keys(mapa).length) s.setItem(clave(id), JSON.stringify(mapa)); else s.removeItem(clave(id)); } } catch { /* memoria autoritativa */ }
};
const aplicar = (id: string, mapa: BorradoresConteo): void => { memoria.set(id, mapa); persistir(id, mapa); notificar(id); };

export const obtenerTokenBorradores = (usuarioId: IdUsuario): number => { const id = normalizar(usuarioId); return id ? tokens.get(id) ?? 0 : 0; };
export function obtenerBorradoresConteo(usuarioId: IdUsuario): BorradoresConteo {
  const id = normalizar(usuarioId);
  if (!id) return BORRADORES_VACIOS;
  if (!memoria.has(id)) memoria.set(id, cargar(id));
  return memoria.get(id)!;
}

export function guardarBorradorConteo(usuarioId: IdUsuario, token: number, entrada: EntradaBorrador, texto: string, ahora: number, crearNonce: () => string): BorradorConteo | null {
  const id = normalizar(usuarioId);
  if (!id || token !== obtenerTokenBorradores(id)) return null;
  const actuales = obtenerBorradoresConteo(id);
  let resultado: ReturnType<typeof guardarCantidadTexto>;
  try { resultado = guardarCantidadTexto(actuales, entrada, texto, ahora, crearNonce); } catch { return null; }
  if (resultado.borradores !== actuales) aplicar(id, resultado.borradores);
  return resultado.borrador;
}

export function descartarBorradorConteo(usuarioId: IdUsuario, token: number, productoId: number, ubicacion: UbicacionInventario, nonceEsperado?: string): void {
  const id = normalizar(usuarioId);
  if (!id || token !== obtenerTokenBorradores(id)) return;
  const actuales = obtenerBorradoresConteo(id);
  const restantes = descartarBorrador(actuales, productoId, ubicacion, nonceEsperado);
  if (restantes !== actuales) aplicar(id, restantes);
}

export function limpiarBorradoresConteo(usuarioId: IdUsuario): void {
  const id = normalizar(usuarioId);
  if (!id) return;
  const tenia = Object.keys(obtenerBorradoresConteo(id)).length > 0;
  tokens.set(id, obtenerTokenBorradores(id) + 1);
  memoria.set(id, BORRADORES_VACIOS);
  try { leerStorage()?.removeItem(clave(id)); } catch { /* best effort */ }
  if (tenia) notificar(id);
}

export function suscribirBorradoresConteo(usuarioId: IdUsuario, oyente: () => void): () => void {
  const id = normalizar(usuarioId);
  if (!id) return () => {};
  oyentes.set(id, (oyentes.get(id) ?? new Set<() => void>()).add(oyente));
  return () => void oyentes.get(id)?.delete(oyente);
}
