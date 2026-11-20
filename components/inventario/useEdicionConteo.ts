"use client";

import { useState } from "react";
import { useBodegaTrabajo } from "@/components/inventario/useBodegaTrabajo";
import { useBorradoresConteo } from "@/components/inventario/useBorradoresConteo";
import type { MensajeVista } from "@/components/inventario/FormularioConteoVista";
import { claveBorrador, type BorradorConteo } from "@/lib/inventario/borradores-conteo";
import type { FilaInventario, PosicionContada } from "@/lib/inventario/consultas";
import { comparacion, construirUbicacion, posicionVigente, type SeleccionParcial } from "@/lib/inventario/formulario-conteo";
import { bodegaActivaDe } from "@/lib/inventario/sugerencia-bodega";
import type { UbicacionInventario } from "@/lib/inventario/ubicaciones";

export const MENSAJE_BORRADOR = "No se pudo conservar el borrador. Intenta nuevamente.";

export type EdicionConteo = {
  bodegaTrabajo: 1 | 2 | null; seleccion: SeleccionParcial | null; ubicacion: UbicacionInventario | null;
  vigente: PosicionContada | null; draft: BorradorConteo | null; clave: string | null;
  texto: string; cantidad: number | null; diferencia: number | null; invalido: boolean;
  restaurable: BorradorConteo | null; mensaje: MensajeVista | null;
  elegirBodega(b: 1 | 2 | null): void; cambiarCampo(campo: "planta" | "pasillo" | "posicion", valor: string): void;
  cambiarTexto(texto: string): void;
  guardarBorrador(opciones?: { expectedConteoId: number | null }): BorradorConteo | null;
  restaurar(): void; descartarEn(productoId: number, ubicacion: UbicacionInventario, nonce: string): void;
  descartarActual(): void; limpiarEdicion(): void; avisar(mensaje: MensajeVista | null): void;
};

export function useEdicionConteo(fila: FilaInventario, usuarioId: string, bloqueado: boolean): EdicionConteo {
  const { bodegaTrabajo, fijarBodegaTrabajo } = useBodegaTrabajo(usuarioId);
  const { borrador, ultimoCompatible, guardar, descartar } = useBorradoresConteo(usuarioId);
  const [manual, setManual] = useState<SeleccionParcial | null>(null);
  const [edicion, setEdicion] = useState<{ clave: string; texto: string } | null>(null);
  const [mensaje, setMensaje] = useState<MensajeVista | null>(null);

  const activa = bodegaActivaDe(bodegaTrabajo, fila.sugerenciaBodega);
  const seleccion = manual && manual.bodega === activa ? manual : null;
  const ubicacion = seleccion ? construirUbicacion(seleccion) : null;
  const vigente = ubicacion ? posicionVigente(fila.posiciones, ubicacion) : null;
  const draft = ubicacion ? borrador(fila.id, ubicacion) : null;
  const clave = ubicacion ? claveBorrador(fila.id, ubicacion) : null;
  const texto = edicion && edicion.clave === clave ? edicion.texto : draft?.cantidadTexto ?? "";
  const { cantidad, diferencia } = comparacion(vigente?.cantidad ?? null, texto);
  const restaurable = !ubicacion && activa ? ultimoCompatible(fila.id, activa) : null;
  const invalido = texto.length > 0 && cantidad === null;
  const elegirBodega = (b: 1 | 2 | null) => { fijarBodegaTrabajo(b); setMensaje(null); };

  const cambiarCampo = (campo: "planta" | "pasillo" | "posicion", valor: string) => {
    if (!activa || bloqueado) return;
    const base: SeleccionParcial = manual?.bodega === activa ? manual : { bodega: activa, planta: "", pasillo: "", posicion: "" };
    setManual(campo === "planta" ? { ...base, planta: valor } : campo === "pasillo" ? { ...base, pasillo: valor } : { ...base, posicion: valor });
  };

  const cambiarTexto = (t: string) => {
    if (bloqueado || !clave || !ubicacion) return;
    setEdicion({ clave, texto: t });
    const b = guardar({ productoId: fila.id, ubicacion, expectedConteoId: draft ? draft.expectedConteoId : vigente?.id ?? null }, t);
    setMensaje(b ? null : { tono: "error", texto: MENSAJE_BORRADOR });
  };

  const guardarBorrador = (opciones?: { expectedConteoId: number | null }): BorradorConteo | null => {
    if (!clave || !ubicacion) return null;
    const expectedConteoId = opciones ? opciones.expectedConteoId : draft ? draft.expectedConteoId : vigente?.id ?? null;
    const b = guardar({ productoId: fila.id, ubicacion, expectedConteoId }, texto);
    if (b) { setMensaje(null); return b; }
    setEdicion({ clave, texto }); setMensaje({ tono: "error", texto: MENSAJE_BORRADOR });
    return null;
  };
  const restaurar = () => {
    if (bloqueado || !restaurable) return;
    setManual(restaurable.ubicacion); setEdicion(null); setMensaje({ tono: "info", texto: "Borrador restaurado." });
  };

  const descartarActual = () => {
    if (bloqueado || !draft || !ubicacion) return;
    descartar(fila.id, ubicacion, draft.nonce); setEdicion(null); setMensaje(null);
  };

  return {
    bodegaTrabajo, seleccion, ubicacion, vigente, draft, clave, texto, cantidad, diferencia, invalido,
    restaurable, mensaje, elegirBodega, cambiarCampo, cambiarTexto, guardarBorrador, restaurar,
    descartarEn: descartar, descartarActual, limpiarEdicion: () => setEdicion(null), avisar: setMensaje,
  };
}
