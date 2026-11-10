"use client";

import { useState } from "react";
import type { ResumenInversion } from "@/lib/utils/inversion-resumen";
import {
  formatearMoneda,
  formatearNumero,
  formatearPromedio,
} from "@/lib/utils/inversion-formato";
import DetalleCodigo from "./DetalleCodigo";

export interface FilaVista {
  codigo: string;
  detalle: string;
  stock: string;
  valorTotal: string;
  costoPromedio: string;
  sinCosto: string;
  tieneSinCosto: boolean;
  sinCostoTotal: boolean;
}

/** Proyección pura de filas (exportada para test sin render). */
export function filasParaVista(resumen: ResumenInversion): FilaVista[] {
  return resumen.filas.map((f) => ({
    codigo: f.codigo,
    detalle: f.detalle ?? "---",
    stock: formatearNumero(f.stock),
    valorTotal: formatearMoneda(f.valorTotal),
    costoPromedio: formatearPromedio(f.costoPromedioUnitario),
    sinCosto: formatearNumero(f.cantidadSinCosto),
    tieneSinCosto: f.cantidadSinCosto > 0,
    sinCostoTotal: f.cantidadSinCosto === f.stock,
  }));
}

export default function TablaInversion({ resumen }: { resumen: ResumenInversion }) {
  const filas = filasParaVista(resumen);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);

  return (
    <>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalle</th>
            <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Stock</th>
            <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Valor</th>
            <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Costo prom.</th>
            <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Sin costo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((f) => (
            <tr key={f.codigo} className="hover:bg-slate-50 transition-colors">
              <td className="py-2.5 pl-4 pr-3">
                <button
                  type="button"
                  onClick={() => setSeleccionado(f.codigo)}
                  aria-haspopup="dialog"
                  className="font-semibold text-xs text-violet-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
                >
                  {f.codigo}
                </button>
              </td>
              <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                <span className="line-clamp-2 leading-snug text-xs">{f.detalle}</span>
              </td>
              <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums">
                {f.stock}
              </td>
              <td className="py-2.5 px-3 text-right font-semibold text-slate-800 tabular-nums">
                {f.valorTotal}
              </td>
              <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">
                {f.costoPromedio}
              </td>
              <td
                className={`py-2.5 pl-3 pr-4 text-right tabular-nums ${
                  f.tieneSinCosto ? "text-amber-600 font-medium" : "text-slate-400"
                }`}
                title={f.sinCostoTotal ? "Sin compras registradas" : undefined}
              >
                {f.sinCosto}
              </td>
            </tr>
          ))}
          {filas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                Sin productos con stock
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    {seleccionado && (
      <DetalleCodigo
        codigo={seleccionado}
        onClose={() => setSeleccionado(null)}
      />
    )}
    </>
  );
}
