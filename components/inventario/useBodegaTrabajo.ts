"use client";

import { useCallback, useSyncExternalStore } from "react";

export type BodegaTrabajo = 1 | 2 | null;
export type IdBodega = string | number | null | undefined;

// ponytail: store de módulo por pestaña; la clave incluye el userId.
const PREFIJO = "inventario.bodega-trabajo.v1.";
const memoria = new Map<string, BodegaTrabajo>();
const oyentes = new Map<string, Set<() => void>>();
const normalizar = (id: IdBodega): string => (id === null || id === undefined ? "" : String(id).trim());
const clave = (id: string): string => PREFIJO + id;
const parsear = (raw: string | null): BodegaTrabajo => (raw === "1" ? 1 : raw === "2" ? 2 : null);

const leerStorage = (): Storage | null => {
  try {
    return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? null;
  } catch {
    return null; // accessor denegado: la memoria sostiene el estado
  }
};

export function obtenerBodegaTrabajo(userId: IdBodega): BodegaTrabajo {
  const id = normalizar(userId);
  if (!id) return null;
  if (memoria.has(id)) return memoria.get(id) ?? null;
  let valor: BodegaTrabajo = null;
  try {
    valor = parsear(leerStorage()?.getItem(clave(id)) ?? null);
  } catch {
    valor = null;
  }
  memoria.set(id, valor); // primera lectura; después manda la memoria
  return valor;
}

export function fijarBodegaTrabajo(userId: IdBodega, valor: BodegaTrabajo): void {
  const id = normalizar(userId);
  if (!id || (valor !== 1 && valor !== 2 && valor !== null)) return;
  const actual = obtenerBodegaTrabajo(id);
  if (valor === null) {
    try { leerStorage()?.removeItem(clave(id)); } catch { /* storage caído */ }
    if (actual === null) return; // limpieza idempotente: no notifica
  } else {
    if (actual === valor) return;
    try { leerStorage()?.setItem(clave(id), String(valor)); } catch { /* memoria autoritativa */ }
  }
  memoria.set(id, valor);
  for (const oyente of oyentes.get(id) ?? []) oyente();
}

export const limpiarBodegaTrabajo = (userId: IdBodega): void => fijarBodegaTrabajo(userId, null);

export function suscribirBodegaTrabajo(userId: IdBodega, oyente: () => void): () => void {
  const id = normalizar(userId);
  if (!id) return () => {};
  const sus = oyentes.get(id) ?? new Set<() => void>();
  sus.add(oyente);
  oyentes.set(id, sus);
  return () => void sus.delete(oyente);
}
const SIN_SERVIDOR = (): BodegaTrabajo => null;

export function useBodegaTrabajo(userId: IdBodega): { bodegaTrabajo: BodegaTrabajo; fijarBodegaTrabajo: (valor: BodegaTrabajo) => void; limpiarBodegaTrabajo: () => void } {
  const id = normalizar(userId);
  // Callbacks estables por uid: evita re-suscripción en cada render.
  const suscribir = useCallback((o: () => void) => suscribirBodegaTrabajo(id, o), [id]);
  const obtener = useCallback(() => obtenerBodegaTrabajo(id), [id]);
  const fijar = useCallback((valor: BodegaTrabajo) => fijarBodegaTrabajo(id, valor), [id]);
  const limpiar = useCallback(() => limpiarBodegaTrabajo(id), [id]);
  // SSR: no se lee storage; el snapshot de servidor es siempre null.
  return { bodegaTrabajo: useSyncExternalStore(suscribir, obtener, SIN_SERVIDOR), fijarBodegaTrabajo: fijar, limpiarBodegaTrabajo: limpiar };
}
