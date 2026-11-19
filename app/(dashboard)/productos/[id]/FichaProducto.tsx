import Link from "next/link";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { FormularioConteo } from "@/components/inventario/FormularioConteo";
import { formatearFechaChile } from "@/lib/utils/fecha-chile";
import { etiquetaUbicacion, type UbicacionInventario } from "@/lib/inventario/ubicaciones";
import type { FilaInventario, PosicionContada } from "@/lib/inventario/consultas";
const horaChile = (iso: string) => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
// Cast puntual: el schema de DB restringe estas columnas a los valores del union.
const ubicacion = (p: PosicionContada) => etiquetaUbicacion({ bodega: p.bodega, planta: p.planta, pasillo: p.pasillo, posicion: p.posicion } as UbicacionInventario);
export function FichaProducto({ fila, usuarioId, refQ }: { fila: FilaInventario; usuarioId: string; refQ?: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
      <Link href={refQ ? `/inventario?q=${encodeURIComponent(refQ)}` : "/inventario"}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors">
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver a inventario
      </Link>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0"><ProductoThumbnail src={fila.imagenUrl} alt={fila.codigo} size="lg" /></div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Producto</p><h1 className="break-words text-2xl font-bold text-slate-900">{fila.codigo}</h1>
          {fila.detalle && <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-500">{fila.detalle}</p>}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3.5"><h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conteo</h2></div>
        <div className="min-w-0 px-5 pt-4"><FormularioConteo key={`${usuarioId}:${fila.id}`} fila={fila} usuarioId={usuarioId} /></div>
        <p className="px-5 pt-4 text-sm font-medium text-slate-800">{fila.stockContado === null ? "Sin contar" : `Total contado: ${fila.stockContado}`}</p>
        {fila.posiciones.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">Sin posiciones contadas</p>
        ) : (
          <ul className="space-y-2 p-5">
            {fila.posiciones.map((p) => (
              <li key={p.id} className="min-w-0 break-words rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{ubicacion(p)}</span>
                {" · "}{p.cantidad} u.
                {" · "}{formatearFechaChile(p.creadoEn)} {horaChile(p.creadoEn)}
                {" · "}{p.usuario}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{[
          { label: "Codigo personal", value: fila.codigoPersonal ?? "---" },
          { label: "Packing", value: fila.packing ? `${fila.packing} unids/caja` : "---" },
          { label: "Observaciones", value: fila.observaciones ?? "---" },
        ].map(({ label, value }) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
            <span className="min-w-0 break-words text-sm text-slate-800 sm:text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
