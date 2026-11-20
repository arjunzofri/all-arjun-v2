"use client";
import { useEffect, useRef, useState, type ReactElement, type SyntheticEvent } from "react";
import { getComprasProducto, type CompraFicha } from "@/lib/inventario/consultas";
import { formatearFecha, formatearMoneda, formatearNumero } from "@/lib/utils/inversion-formato";
const MENSAJE_ERROR = "No se pudo cargar el historial de compras. Intente nuevamente.";
type Cursor = { fechaConfirmacion: string; id: number };
const columnas = (esAdmin: boolean) => [
  { label: "Fecha", valor: (c: CompraFicha) => formatearFecha(c.fechaConfirmacion) },
  { label: "Nota", valor: (c: CompraFicha) => (c.item === null ? c.folio : `${c.folio} · ${c.item}`) },
  { label: "Bodega", valor: (c: CompraFicha) => c.bodega ?? "Sin bodega" },
  { label: "Cantidad", valor: (c: CompraFicha) => formatearNumero(c.cantidad) },
  ...(esAdmin ? [{ label: "Costo unit.", valor: (c: CompraFicha) => (c.precioUnitario == null ? "Sin costo" : formatearMoneda(c.precioUnitario)) }] : []),
];

export function ComprasFicha({ productoId, esAdmin = false }: { productoId: number; esAdmin?: boolean }): ReactElement {
  const [items, setItems] = useState<CompraFicha[] | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);

  async function cargar(c: Cursor | null) {
    if (enCurso.current) return;
    enCurso.current = true;
    setCargando(true);
    setError(null);
    try {
      const r = await getComprasProducto(c === null ? { productoId, limit: 20 } : { productoId, limit: 20, cursor: c });
      if (!montado.current) return;
      setItems((prev) => [...(prev ?? []), ...r.items]);
      setCursor(r.nextCursor);
    } catch {
      if (montado.current) setError(MENSAJE_ERROR);
    } finally {
      enCurso.current = false;
      if (montado.current) setCargando(false);
    }
  }

  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open && items === null && !error) void cargar(null);
  };
  const cols = columnas(esAdmin);

  return (
    <details className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onToggle={onToggle}>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Compras</summary>
      <div className="pt-3">
        {cargando && <p className="text-sm text-slate-400">Cargando…</p>}
        {error !== null && !cargando && (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={() => void cargar(cursor)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Reintentar</button>
          </div>
        )}
        {items !== null && items.length === 0 && <p className="text-sm text-slate-400">Sin compras importadas</p>}
        {items !== null && items.length > 0 && (
          <table className="w-full min-w-0 text-xs sm:text-sm">
            <thead className="hidden sm:table-header-group">
              <tr className="border-b border-slate-100 text-left text-slate-400">
                {cols.map((c) => <th key={c.label} className="py-2 pr-3 font-semibold last:pr-0">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="grid grid-cols-2 gap-x-3 py-2 sm:table-row sm:py-0">
                  {cols.map((col) => (
                    <td key={col.label} data-label={col.label}
                      className="min-w-0 break-words py-0.5 pr-3 text-slate-700 before:mr-1 before:font-medium before:text-slate-400 before:content-[attr(data-label)] sm:table-cell sm:py-2 sm:before:content-none">
                      {col.valor(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items !== null && cursor !== null && error === null && (
          <button type="button" disabled={cargando} onClick={() => void cargar(cursor)} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Ver más</button>
        )}
      </div>
    </details>
  );
}
