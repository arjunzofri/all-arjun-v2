"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  BORRADORES_VACIOS,
  descartarBorradorConteo,
  guardarBorradorConteo,
  obtenerBorradoresConteo,
  obtenerTokenBorradores,
  suscribirBorradoresConteo,
  type IdUsuario,
} from "@/components/inventario/borradoresConteoStore";
import {
  borradoresDeProducto,
  obtenerBorrador,
  ultimoBorradorCompatible,
  type BorradorConteo,
  type BorradoresConteo,
  type EntradaBorrador,
} from "@/lib/inventario/borradores-conteo";
import type { BodegaInventario, UbicacionInventario } from "@/lib/inventario/ubicaciones";

const normalizar = (id: IdUsuario): string => (id === null || id === undefined ? "" : String(id).trim());
const SIN_SERVIDOR = (): BorradoresConteo => BORRADORES_VACIOS;
const uuid = (): string => globalThis.crypto.randomUUID();

export function useBorradoresConteo(usuarioId: IdUsuario): {
  borradores: BorradoresConteo;
  borrador: (productoId: number, ubicacion: UbicacionInventario) => BorradorConteo | null;
  deProducto: (productoId: number) => BorradorConteo[];
  ultimoCompatible: (productoId: number, bodega: BodegaInventario) => BorradorConteo | null;
  guardar: (entrada: EntradaBorrador, texto: string, ahora?: number) => BorradorConteo | null;
  descartar: (productoId: number, ubicacion: UbicacionInventario, nonceEsperado?: string) => void;
} {
  const id = normalizar(usuarioId);
  // Callbacks estables por uid normalizado: sin re-suscripción entre renders.
  const suscribir = useCallback((o: () => void) => suscribirBorradoresConteo(id, o), [id]);
  const obtener = useCallback(() => (id ? obtenerBorradoresConteo(id) : BORRADORES_VACIOS), [id]);
  // SSR: snapshot constante vacío, sin tocar storage ni siquiera con el accessor denegado.
  const borradores = useSyncExternalStore(suscribir, obtener, SIN_SERVIDOR);
  // ponytail: token congelado por montaje/uid; una limpieza posterior deja obsoletos estos mutadores.
  const token = useMemo(() => obtenerTokenBorradores(id), [id]);
  const borrador = useCallback((productoId: number, ubicacion: UbicacionInventario) => obtenerBorrador(borradores, productoId, ubicacion), [borradores]);
  const deProducto = useCallback((productoId: number) => borradoresDeProducto(borradores, productoId), [borradores]);
  const ultimoCompatible = useCallback((productoId: number, bodega: BodegaInventario) => ultimoBorradorCompatible(borradores, productoId, bodega), [borradores]);
  const guardar = useCallback((entrada: EntradaBorrador, texto: string, ahora = Date.now()) => guardarBorradorConteo(id, token, entrada, texto, ahora, uuid), [id, token]);
  const descartar = useCallback((productoId: number, ubicacion: UbicacionInventario, nonceEsperado?: string) => descartarBorradorConteo(id, token, productoId, ubicacion, nonceEsperado), [id, token]);
  return { borradores, borrador, deProducto, ultimoCompatible, guardar, descartar };
}
