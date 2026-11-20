import Link from "next/link";
import { ImagenProducto } from "./imagen";
import { FormularioConteo } from "@/components/inventario/FormularioConteo";
import { HistorialConteos } from "@/components/inventario/HistorialConteos";
import { EditorFichaProducto } from "@/components/inventario/EditorFichaProducto";
import { ValorizacionFicha } from "@/components/inventario/ValorizacionFicha";
import type { ValorizacionCodigo } from "@/lib/inventario/valorizacion";
import { claveHistorial } from "@/lib/inventario/historial-conteo";
import { formatearFechaChile, formatearHoraChile } from "@/lib/utils/fecha-chile";
import { formatearNumero } from "@/lib/utils/inversion-formato";
import { etiquetaUbicacion, type UbicacionInventario } from "@/lib/inventario/ubicaciones";
import type { FilaInventario, PosicionContada } from "@/lib/inventario/consultas";
// Cast puntual: el schema de DB restringe estas columnas a los valores del union.
const ubicacion = (p: PosicionContada) => etiquetaUbicacion({ bodega: p.bodega, planta: p.planta, pasillo: p.pasillo, posicion: p.posicion } as UbicacionInventario);
export function FichaProducto({ fila, usuarioId, refQ, valorizacion }: {
  fila: FilaInventario; usuarioId: string; refQ?: string;
  valorizacion?: { valorizacion: ValorizacionCodigo | null; error: boolean };
}) {
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
      <Link href={refQ ? `/inventario?q=${encodeURIComponent(refQ)}` : "/inventario"}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver a inventario
      </Link>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
        <div className="w-40 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white"><ImagenProducto key={`${usuarioId}:${fila.id}`} productoId={fila.id} imagenUrl={fila.imagenUrl} /></div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Producto</p><h1 className="break-words text-2xl font-bold text-slate-900">{fila.codigo}</h1>
          {fila.detalle && <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-500">{fila.detalle}</p>}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conteo</h2></div>
        <div className="min-w-0 px-5 pt-4"><FormularioConteo key={`${usuarioId}:${fila.id}`} fila={fila} usuarioId={usuarioId} /></div>
        <p className="px-5 pt-4 text-sm font-medium text-slate-800">{fila.stockContado === null ? "Sin contar" : `Total contado: ${formatearNumero(fila.stockContado)}`}</p>
        {fila.posiciones.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">Sin posiciones contadas</p>
        ) : (
          <ul className="space-y-2 p-5">
            {fila.posiciones.map((p) => (
              <li key={p.id} className="min-w-0 break-words rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{ubicacion(p)}</span>
                {" · "}{formatearNumero(p.cantidad)} u.
                {" · "}{formatearFechaChile(p.creadoEn)} {formatearHoraChile(p.creadoEn)}
                {" · "}{p.usuario}
              </li>
            ))}
          </ul>
        )}
      </div>
      <HistorialConteos key={claveHistorial(usuarioId, fila.id, fila.posiciones)} productoId={fila.id} />
      {valorizacion && <ValorizacionFicha valorizacion={valorizacion.valorizacion} error={valorizacion.error} />}
      <EditorFichaProducto key={`${usuarioId}:${fila.id}`} fila={fila} />
    </div>
  );
}
