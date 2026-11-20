"use client";
import { useEffect, useRef, useState, type ReactElement, type SyntheticEvent } from "react";
import { getHistorialConteos, type PosicionContada } from "@/lib/inventario/consultas";
import { etiquetaUbicacion, type UbicacionInventario } from "@/lib/inventario/ubicaciones";
import { formatearFechaChile, formatearHoraChile } from "@/lib/utils/fecha-chile";
import { formatearNumero } from "@/lib/utils/inversion-formato";
const MENSAJE_ERROR = "No se pudo obtener el historial. Intente nuevamente.";
const ubicacion = (p: PosicionContada) => etiquetaUbicacion({ bodega: p.bodega, planta: p.planta, pasillo: p.pasillo, posicion: p.posicion } as UbicacionInventario);
const fila = (p: PosicionContada) => `${ubicacion(p)} · ${formatearNumero(p.cantidad)} u. · ${formatearFechaChile(p.creadoEn)} ${formatearHoraChile(p.creadoEn)} · ${p.usuario}`;

export function HistorialConteos({ productoId }: { productoId: number }): ReactElement {
  const [items, setItems] = useState<PosicionContada[] | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);

  async function cargar(c: number | null) {
    if (enCurso.current) return;
    enCurso.current = true;
    setCargando(true);
    setError(null);
    try {
      const r = await getHistorialConteos(c === null ? { productoId, limit: 10 } : { productoId, limit: 10, cursor: c });
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

  return (
    <details className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onToggle={onToggle}>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Historial de conteos</summary>
      <div className="pt-3">
        {cargando && <p className="text-sm text-slate-400">Cargando…</p>}
        {error !== null && !cargando && (
          <div className="space-y-2">
            <p className="text-sm text-red-600">{error}</p>
            <button type="button" onClick={() => void cargar(cursor)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Reintentar</button>
          </div>
        )}
        {items !== null && items.length === 0 && <p className="text-sm text-slate-400">No hay conteos registrados para este producto.</p>}
        {items !== null && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id} className="min-w-0 break-words rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">{fila(p)}</li>
            ))}
          </ul>
        )}
        {items !== null && cursor !== null && error === null && (
          <button type="button" disabled={cargando} onClick={() => void cargar(cursor)} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Ver más</button>
        )}
      </div>
    </details>
  );
}
