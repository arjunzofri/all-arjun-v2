import type { PartidaValorizacion, ValorizacionCodigo } from "@/lib/inventario/valorizacion";
import { formatearFecha, formatearMoneda, formatearNumero, formatearPromedio } from "@/lib/utils/inversion-formato";

const columnas: { label: string; valor: (p: PartidaValorizacion) => string }[] = [
  { label: "Fecha", valor: (p) => formatearFecha(p.fechaConfirmacion) },
  { label: "Nota", valor: (p) => (p.item === null ? p.folio : `${p.folio} · ${p.item}`) },
  { label: "Comprado", valor: (p) => formatearNumero(p.cantidadComprada) },
  { label: "Saldo", valor: (p) => formatearNumero(p.cantidadSaldo) },
  { label: "Costo unit.", valor: (p) => (p.costoUnitario === null ? "—" : formatearMoneda(p.costoUnitario)) },
  { label: "Valor", valor: (p) => (p.valor === null ? "—" : formatearMoneda(p.valor)) },
];
const MENSAJE_ERROR = "No se pudo cargar la valorización";
const MENSAJE_SIN_CONTEO = "Este producto aún no tiene conteos. La valorización se calcula con el último conteo físico.";
const rango = (v: ValorizacionCodigo) => v.fechaConteoMin === v.fechaConteoMax
  ? `Conteo: ${formatearFecha(v.fechaConteoMin)}`
  : `Conteos: ${formatearFecha(v.fechaConteoMin)} a ${formatearFecha(v.fechaConteoMax)}`;

/** Desplegable de valorización por lotes. Solo se renderiza para admin. */
export function ValorizacionFicha({ valorizacion: v, error }: { valorizacion: ValorizacionCodigo | null; error: boolean }) {
  const resumen = error ? MENSAJE_ERROR
    : v === null ? "Pendiente de contar"
    : `Costo prom.: ${formatearPromedio(v.costoPromedio)} · Valor: ${formatearMoneda(v.valorTotal)}`;
  return (
    <details className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer break-words px-5 py-3.5 text-sm font-semibold text-slate-800">Valorización · {resumen}</summary>
      {error && <div className="min-w-0 border-t border-slate-100 px-5 py-4"><p className="text-sm text-red-600">{MENSAJE_ERROR}</p></div>}
      {!error && v === null && <div className="min-w-0 border-t border-slate-100 px-5 py-4"><p className="text-sm text-slate-400">{MENSAJE_SIN_CONTEO}</p></div>}
      {!error && v !== null && (
        <div className="min-w-0 border-t border-slate-100 px-5 py-4">
          <p className="mb-2 text-xs text-slate-500">{rango(v)}</p>
          {v.fechasDistintas && <p className="mb-2 text-xs text-amber-600">Los conteos tienen fechas distintas.</p>}
          {v.incompleto && <p className="mb-2 text-xs text-amber-600">Valorización incompleta: {formatearNumero(v.cantidadSinCosto)} unidades sin costo.</p>}
          {v.partidas.length === 0 ? (
            <p className="text-sm text-slate-400">Sin compras elegibles para las fechas de conteo</p>
          ) : (
            <table className="w-full min-w-0 text-xs sm:text-sm">
              <thead className="hidden sm:table-header-group">
                <tr className="border-b border-slate-100 text-left text-slate-400">
                  {columnas.map((c) => <th key={c.label} className="py-2 pr-3 font-semibold last:pr-0">{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {v.partidas.map((p) => (
                  <tr key={p.loteId} className="grid grid-cols-2 gap-x-3 py-2 sm:table-row sm:py-0">
                    {columnas.map((c) => (
                      <td key={c.label} data-label={c.label}
                        className="min-w-0 break-words py-0.5 pr-3 text-slate-700 before:mr-1 before:font-medium before:text-slate-400 before:content-[attr(data-label)] sm:table-cell sm:py-2 sm:before:content-none">
                        {c.valor(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </details>
  );
}
