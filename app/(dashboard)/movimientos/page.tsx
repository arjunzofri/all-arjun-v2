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
      <div className="flex flex-wrap gap-3 mb-4">
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
            onClick={() => {
              setTipo("todas");
              setDesde("");
              setHasta("");
            }}
            className="text-sm text-slate-500 hover:text-violet-600 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="py-2">Fecha</th>
              <th className="py-2">Tipo</th>
              <th className="py-2 w-8"></th>
              <th className="py-2">Código</th>
              <th className="py-2">Detalle</th>
              <th className="py-2">Obs.</th>
              <th className="py-2">Usuario</th>
              <th className="py-2 text-right">Cant</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-3 text-sm text-slate-500">
                  {new Date(m.createdAt).toLocaleString()}
                </td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      m.tipo === "entrada"
                        ? "bg-green-100 text-green-800"
                        : m.tipo === "salida"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {m.tipo}
                  </span>
                </td>
                <td className="py-1">
                  <ProductoThumbnail src={m.imagenUrl} alt={m.productoCodigo} size="sm" />
                </td>
                <td className="py-3 text-sm font-medium text-slate-800">{m.productoCodigo}</td>
                <td className="py-3 text-sm text-slate-600">
                  {m.productoDetalle ?? "—"}
                </td>
                <td className="py-3 text-sm text-slate-500 max-w-48 truncate" title={m.observaciones ?? undefined}>
                  {m.observaciones ?? "—"}
                </td>
                <td className="py-3 text-sm text-slate-600">{m.usuario}</td>
                <td className="py-3 text-sm text-right font-semibold text-slate-800">
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
          onClick={() => {
            setCursor(nextCursor);
            cargar();
          }}
          disabled={loading}
          className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-violet-300 transition-colors disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </div>
  );
}

