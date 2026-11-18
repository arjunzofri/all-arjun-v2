"use client";
import { useId, type ReactElement, type ReactNode } from "react";
import { esUbicacionValida, etiquetaUbicacion, opcionesUbicacion } from "@/lib/inventario/ubicaciones";
import { MAX_TEXTO_CANTIDAD, type BorradorConteo } from "@/lib/inventario/borradores-conteo";
import type { PosicionContada } from "@/lib/inventario/consultas";
import type { SeleccionParcial } from "@/lib/inventario/formulario-conteo";
import { formatearFechaChile } from "@/lib/utils/fecha-chile";

export type MensajeVista = { tono: "exito" | "error" | "info"; texto: string };
export type ConflictoVista = {
  vigente: { id: number; cantidad: number; creadoEn: string } | null;
  propuesta: number;
};
export type PropsFormularioVista = {
  bodega: { trabajo: 1 | 2 | null; onElegir: (b: 1 | 2 | null) => void };
  ubicacion: { seleccion: SeleccionParcial | null; vigente: PosicionContada | null; onCambiar: (campo: "planta" | "pasillo" | "posicion", valor: string) => void };
  cantidad: { texto: string; valor: number | null; diferencia: number | null; invalido: boolean; onCambiar: (texto: string) => void };
  borrador: { actual: boolean; restaurable: BorradorConteo | null; onRestaurar: () => void; onDescartar: () => void };
  envio: { estado: "listo" | "guardando"; mensaje: MensajeVista | null; conflicto: ConflictoVista | null; onGuardar: () => void; onReintentar: () => void; onVolverAContar: () => void; onCancelarRevision: () => void };
};

type Opcion = { codigo: string; etiqueta: string };
const horaChile = (iso: string) => Number.isNaN(Date.parse(iso)) ? "—" : new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const Campo = (p: { id: string; etiqueta: string; children: ReactNode }) => (
  <div className="min-w-0">
    <label htmlFor={p.id} className="block text-xs font-semibold text-slate-600">{p.etiqueta}</label>
    {p.children}
  </div>
);
const Selector = (p: { id: string; etiqueta: string; valor: string; vacio: string; opciones: readonly Opcion[]; disabled: boolean; onCambiar: (valor: string) => void }) => (
  <Campo id={p.id} etiqueta={p.etiqueta}>
    <select id={p.id} value={p.valor} disabled={p.disabled} onChange={(e) => p.onCambiar(e.target.value)} className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
      <option value="">{p.vacio}</option>
      {p.opciones.map((o) => <option key={o.codigo} value={o.codigo}>{o.etiqueta}</option>)}
    </select>
  </Campo>
);
const Boton = (p: { children: ReactNode; onClick?: () => void; disabled?: boolean; tipo?: "button" | "submit"; tono?: "primario" | "secundario" }) => (
  <button type={p.tipo ?? "button"} disabled={p.disabled} onClick={p.onClick} className={`w-full min-w-0 whitespace-normal break-words rounded-lg px-3 py-2 text-sm font-semibold sm:w-auto ${p.tono === "primario" ? "bg-violet-600 text-white disabled:opacity-50" : "border border-slate-300 bg-white text-slate-700 disabled:opacity-50"}`}>{p.children}</button>
);

export function FormularioConteoVista(p: PropsFormularioVista): ReactElement {
  const uid = useId();
  const bodegaActiva = p.ubicacion.seleccion?.bodega ?? p.bodega.trabajo;
  const opciones = bodegaActiva ? opcionesUbicacion(bodegaActiva) : null;
  const ocupado = p.envio.estado === "guardando";
  const completa = !!p.ubicacion.seleccion && esUbicacionValida(p.ubicacion.seleccion);
  const puedeGuardar = completa && p.cantidad.valor !== null && !p.cantidad.invalido && !ocupado && !p.envio.conflicto;
  const bloqueado = !bodegaActiva || ocupado || !!p.envio.conflicto;
  const ids = { pasillo: `${uid}-pasillo`, posicion: `${uid}-posicion`, cantidad: `${uid}-cantidad`, hint: `${uid}-hint`, error: `${uid}-error` };
  const vigente = p.ubicacion.vigente;

  return (
    <form className="min-w-0 space-y-4" aria-busy={ocupado} noValidate onSubmit={(e) => { e.preventDefault(); if (puedeGuardar) p.envio.onGuardar(); }}>
      {p.bodega.trabajo === null ? (
        <Selector id={`${uid}-bodega`} etiqueta="Bodega de trabajo" valor="" vacio="Elegir bodega" disabled={ocupado}
          opciones={[{ codigo: "1", etiqueta: "Bodega 1" }, { codigo: "2", etiqueta: "Bodega 2" }]}
          onCambiar={(v) => p.bodega.onElegir(v === "" ? null : (Number(v) as 1 | 2))} />
      ) : (
        <p className="text-sm font-semibold text-slate-700">Estoy contando en Bodega {p.bodega.trabajo}</p>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
        {bodegaActiva === 2 && (
          <Selector id={`${uid}-planta`} etiqueta="Planta" valor={p.ubicacion.seleccion?.planta ?? ""} vacio="Elegir planta" disabled={bloqueado}
            opciones={opciones!.plantas} onCambiar={(v) => p.ubicacion.onCambiar("planta", v)} />
        )}
        <Selector id={ids.pasillo} etiqueta="Pasillo" valor={p.ubicacion.seleccion?.pasillo ?? ""} vacio="Elegir pasillo" disabled={bloqueado}
          opciones={opciones?.pasillos ?? []} onCambiar={(v) => p.ubicacion.onCambiar("pasillo", v)} />
        <Selector id={ids.posicion} etiqueta="Posición" valor={p.ubicacion.seleccion?.posicion ?? ""} vacio="Elegir posición" disabled={bloqueado}
          opciones={opciones?.posiciones ?? []} onCambiar={(v) => p.ubicacion.onCambiar("posicion", v)} />
      </div>

      {p.ubicacion.seleccion && (
        <dl className="grid min-w-0 grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
          <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">Conteo anterior</dt>
            <dd className="break-words text-slate-700">{vigente ? `${vigente.cantidad} u. · ${formatearFechaChile(vigente.creadoEn)} ${horaChile(vigente.creadoEn)} · ${vigente.usuario}` : "Sin conteo previo"}</dd></div>
          <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">Nuevo conteo</dt>
            <dd className="break-words text-slate-700">{p.cantidad.valor ?? "—"}</dd></div>
          <div className="min-w-0"><dt className="text-xs font-semibold text-slate-500">Diferencia</dt>
            <dd className="break-words text-slate-700">{p.cantidad.diferencia === null ? "—" : p.cantidad.diferencia > 0 ? `+${p.cantidad.diferencia}` : p.cantidad.diferencia}</dd></div>
        </dl>
      )}
      <div className="min-w-0">
        <label htmlFor={ids.cantidad} className="block text-xs font-semibold text-slate-600">Cantidad</label>
        <input id={ids.cantidad} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={MAX_TEXTO_CANTIDAD} autoComplete="off" enterKeyHint="done"
          value={p.cantidad.texto} disabled={!completa || bloqueado} onChange={(e) => p.cantidad.onCambiar(e.target.value)}
          aria-invalid={p.cantidad.invalido} aria-describedby={p.cantidad.invalido ? `${ids.hint} ${ids.error}` : ids.hint}
          className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <p id={ids.hint} className="mt-1 text-xs text-slate-500">Cantidad total contada en esta posición; 0 es un conteo válido.</p>
        {p.cantidad.invalido && <p id={ids.error} role="alert" className="mt-1 text-xs font-semibold text-red-600">Cantidad inválida: ingresa un número entero.</p>}
      </div>

      {p.borrador.restaurable && (
        <Boton onClick={p.borrador.onRestaurar} disabled={ocupado}>Restaurar borrador de {etiquetaUbicacion(p.borrador.restaurable.ubicacion)}</Boton>
      )}
      {p.borrador.actual && !p.envio.conflicto && (
        <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>Borrador sin guardar: se conserva si buscas otro producto o sales de la ficha.</p>
          <div className="mt-2"><Boton onClick={p.borrador.onDescartar} disabled={ocupado}>Descartar borrador</Boton></div>
        </div>
      )}
      {p.envio.conflicto && (
        <div role="alert" className="min-w-0 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold">El conteo cambió mientras editabas</p>
          <p>Vigente: {p.envio.conflicto.vigente ? `${p.envio.conflicto.vigente.cantidad} u. · ${formatearFechaChile(p.envio.conflicto.vigente.creadoEn)} ${horaChile(p.envio.conflicto.vigente.creadoEn)}` : "sin conteo vigente"}</p>
          <p>Tu propuesta: {p.envio.conflicto.propuesta} u.</p>
          <p>Volver a contar no se guarda automáticamente: revisa y guarda de nuevo.</p>
          <div className="flex flex-wrap gap-2">
            <Boton onClick={p.envio.onVolverAContar}>Volver a contar sobre la versión actual</Boton>
            <Boton onClick={p.envio.onCancelarRevision}>Seguir revisando</Boton>
            <Boton onClick={p.borrador.onDescartar}>Descartar borrador</Boton>
          </div>
        </div>
      )}

      {p.envio.mensaje && (
        <p role={p.envio.mensaje.tono === "error" ? "alert" : "status"}
          className={`text-sm font-semibold ${p.envio.mensaje.tono === "error" ? "text-red-700" : "text-emerald-700"}`}>{p.envio.mensaje.texto}</p>
      )}
      {p.envio.mensaje?.tono === "error" && <Boton onClick={p.envio.onReintentar} disabled={!puedeGuardar}>Reintentar</Boton>}

      <Boton tipo="submit" tono="primario" disabled={!puedeGuardar}>{ocupado ? "Guardando…" : "Guardar conteo"}</Boton>
    </form>
  );
}
