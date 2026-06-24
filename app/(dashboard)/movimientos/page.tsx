"use client";

import { useState, useEffect, useCallback } from "react";
import { getMovimientos } from "@/lib/actions/movimientos";
import type { MovimientoItem } from "@/lib/actions/movimientos";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";

const TIPOS = ["todas", "entrada", "salida", "retorno"] as const;

export default function MovimientosPage() {
  const [items, setItems] = useState<MovimientoItem[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [tipo, setTipo] = useState("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(
    async (reset?: boolean) => {
      setLoading(true);
      const page = await getMovimientos({
        tipo: tipo === "todas" ? undefined : tipo,
        desde: desde || undefined,
        hasta: hasta || undefined,
        limit: 20,
        cursor: reset ? undefined : (cursor ?? undefined),
      });
      if (reset) {
        setItems(page.items);
      } else {
        setItems((prev) => [...prev, ...page.items]);
      }
      setNextCursor(page.nextCursor);
      setLoading(false);
    },
    [tipo, desde, hasta, cursor]
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    cargar(true);
  }, [tipo, desde, hasta]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">
        Historial de movimientos
      </h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition bg-white"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t === "todas" ? "Todos los tipos" : t}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition bg-white"
          title="Desde"
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition bg-white"
          title="Hasta"
        />
        {(desde || hasta || tipo !== "todas") && (
          <button
            onClick={() => { setTipo("todas"); setDesde(""); setHasta(""); }}
            className="text-sm text-slate-500 hover:text-violet-600 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-32">Fecha</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Tipo</th>
              <th className="py-3 px-2 w-10"></th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Codigo</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalle</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Obs.</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Usuario</th>
              <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Cant.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 pl-4 pr-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td className="py-2.5 px-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    m.tipo === "entrada"
                      ? "bg-green-100 text-green-700"
                      : m.tipo === "salida"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {m.tipo}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <ProductoThumbnail src={m.imagenUrl} alt={m.productoCodigo} size="sm" />
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-xs text-violet-600">{m.productoCodigo}</span>
                </td>
                <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                  <span className="line-clamp-2 leading-snug text-xs">{m.productoDetalle ?? "---"}</span>
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-500 max-w-36 truncate" title={m.observaciones ?? undefined}>
                  {m.observaciones ?? "---"}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600 font-medium">{m.usuario}</td>
                <td className="py-2.5 pl-3 pr-4 text-right font-bold text-slate-800 tabular-nums">
                  {m.cantidad}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                  Sin movimientos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          onClick={() => { setCursor(nextCursor); cargar(); }}
          disabled={loading}
          className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-violet-300 transition-colors disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Cargar mas"}
        </button>
      )}
    </div>
  );
}