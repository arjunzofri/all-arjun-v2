"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getStockPorUbicacion, getMovimientosPorProductoUbicacion } from "@/lib/actions/vistas";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { AjusteModal } from "@/components/AjusteModal";

type Item = { id: number; codigo: string; detalle: string | null; imagenUrl: string | null; packing: number | null; cantidad: number; totalEntradas: number; totalSalidas: number };
type Tipo = "bodega" | "modulo";
type Page = { items: Item[]; nextCursor: number | null };
type Entrada = { id: number; folio: string | null; fecha: string | null; cantidad: number; precioUnitario: number | null };
type Salida  = { id: number; tipo: string; fecha: string; cantidad: number; destino: string | null; usuario: string };
type MovDetalle = { entradas: Entrada[]; salidas: Salida[] };

export function createDebounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return { trigger() { clearTimeout(timer); timer = setTimeout(fn, ms); }, cancel() { clearTimeout(timer); } };
}
type ExecuteLoadConfig = { load: () => Promise<Page>; reset?: boolean; onSuccess: (result: Page, reset?: boolean) => void; onError: (error: Error) => void; onSettled: () => void; };
export async function executeLoad(config: ExecuteLoadConfig) {
  try { const result = await config.load(); config.onSuccess(result, config.reset); }
  catch (err) { config.onError(err instanceof Error ? err : new Error(String(err))); }
  finally { config.onSettled(); }
}
function formatFecha(iso: string | null): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleDateString("es-CL", { dateStyle: "short" });
}
function ChevronIcon({ open }: { open: boolean }) {
  return (<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={"transition-transform duration-200 " + (open ? "rotate-90" : "")}><path d="M9 18l6-6-6-6"/></svg>);
}
function SubFilasMovimientos({ mov }: { mov: MovDetalle }) {
  // 9 columnas: chevron | imagen | codigo | detalle | packing | entro | salida | saldo | accion
  const hayEntradas = mov.entradas.length > 0;
  const haySalidas  = mov.salidas.length > 0;
  const COLS = 9;
  if (!hayEntradas && !haySalidas) return (
    <tr className="bg-slate-50">
      <td colSpan={COLS} className="py-3 pl-12 pr-4 text-xs text-slate-400 italic">Sin movimientos registrados</td>
    </tr>
  );
  return (
    <>
      {hayEntradas && (<>
        <tr className="bg-violet-50">
          <td colSpan={COLS} className="py-1.5 pl-12 pr-4">
            <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Entradas</span>
          </td>
        </tr>
        {mov.entradas.map(e => (
          <tr key={"e-" + e.id} className="bg-violet-50 border-t border-violet-100">
            {/* col1: chevron — indent */}
            <td className="py-2 pl-4 pr-2"></td>
            {/* col2: imagen — vacio */}
            <td className="py-2 px-2"></td>
            {/* col3: codigo — NV folio */}
            <td className="py-2 px-3 text-xs font-semibold text-slate-700 tabular-nums whitespace-nowrap">{e.folio && !e.folio.startsWith("V1-SAL") && !e.folio.startsWith("MAN-") ? e.folio : "---"}</td>
            {/* col4: detalle — fecha */}
            <td className="py-2 px-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatFecha(e.fecha)}</td>
            {/* col5: packing — costo */}
            <td className="py-2 px-3 text-right text-xs text-slate-500 tabular-nums">{e.precioUnitario !== null ? "USD " + e.precioUnitario.toFixed(2) : "---"}</td>
            {/* col6: entro — +cantidad */}
            <td className="py-2 px-3 text-right text-xs font-bold text-green-600 tabular-nums">+{e.cantidad}</td>
            {/* col7: salida — vacio */}
            <td className="py-2 px-3"></td>
            {/* col8: saldo — vacio */}
            <td className="py-2 px-3"></td>
            {/* col9: accion — vacio */}
            <td className="py-2 pl-3 pr-4"></td>
          </tr>
        ))}
      </>)}
      {haySalidas && (<>
        <tr className="bg-red-50">
          <td colSpan={COLS} className="py-1.5 pl-12 pr-4">
            <span className="text-xs font-semibold text-red-500 uppercase tracking-wide">Salidas</span>
          </td>
        </tr>
        {mov.salidas.map(s => (
          <tr key={"s-" + s.id} className="bg-red-50 border-t border-red-100">
            {/* col1: chevron — indent */}
            <td className="py-2 pl-4 pr-2"></td>
            {/* col2: imagen — badge tipo */}
            <td className="py-2 px-2">
              <span className={"inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium " + (s.tipo === "retorno" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700")}>{s.tipo}</span>
            </td>
            {/* col3: codigo — fecha */}
            <td className="py-2 px-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">{formatFecha(s.fecha)}</td>
            {/* col4: detalle — destino */}
            <td className="py-2 px-3 text-xs text-slate-500 truncate max-w-xs">{s.destino ?? "---"}</td>
            {/* col5: packing — vacio */}
            <td className="py-2 px-3"></td>
            {/* col6: entro — vacio */}
            <td className="py-2 px-3"></td>
            {/* col7: salida — cantidad */}
            <td className="py-2 px-3 text-right text-xs font-bold text-red-500 tabular-nums">{s.cantidad}</td>
            {/* col8: saldo — vacio */}
            <td className="py-2 px-3"></td>
            {/* col9: accion — usuario */}
            <td className="py-2 pl-3 pr-4 text-xs text-slate-400 text-right whitespace-nowrap">{s.usuario}</td>
          </tr>
        ))}
      </>)}
    </>
  );
}
export function UbicacionDetalle({ tipo, nombre: nombreProp }: { tipo: Tipo; nombre?: string }) {
  const params = useParams();
  const ubicacionId = Number(params[tipo === "bodega" ? "bodegaId" : "moduloId"]);
  const label = tipo === "bodega" ? "Bodega" : "Modulo";
  const titulo = nombreProp ?? (label + " " + ubicacionId);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productoParaAjustar, setProductoParaAjustar] = useState<{ id: number; codigo: string } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [movDetalle, setMovDetalle] = useState<Map<number, MovDetalle>>(new Map());
  const [loadingMov, setLoadingMov] = useState<Set<number>>(new Set());
  const cargar = useCallback(async (reset?: boolean, cursorOverride?: number) => {
    setLoading(true);
    await executeLoad({
      load: () => getStockPorUbicacion({ tipo, ubicacionId, limit: 20, cursor: reset ? undefined : (cursorOverride ?? cursor ?? undefined), q: q || undefined, soloConStock }),
      reset,
      onSuccess: (page, isReset) => { if (isReset) { setItems(page.items); } else { setItems(prev => [...prev, ...page.items]); } setNextCursor(page.nextCursor); setError(null); },
      onError: (err) => setError(err.message),
      onSettled: () => setLoading(false),
    });
  }, [tipo, ubicacionId, cursor, q, soloConStock]);
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;
  const debounceRef = useRef<ReturnType<typeof createDebounce> | undefined>(undefined);
  if (!debounceRef.current) { debounceRef.current = createDebounce(() => { setItems([]); setCursor(null); cargarRef.current(true); }, 250); }
  useEffect(() => {
    debounceRef.current?.cancel();
    setItems([]); setCursor(null); cargar(true);
    setExpandedId(null); setMovDetalle(new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ubicacionId, soloConStock]);
  useEffect(() => { return () => debounceRef.current?.cancel(); }, []);
  const toggleExpand = async (productoId: number) => {
    if (expandedId === productoId) { setExpandedId(null); return; }
    setExpandedId(productoId);
    if (movDetalle.has(productoId)) return;
    setLoadingMov(prev => new Set(prev).add(productoId));
    try {
      const data = await getMovimientosPorProductoUbicacion({ productoId, tipo, ubicacionId });
      setMovDetalle(prev => new Map(prev).set(productoId, data));
    } catch { setMovDetalle(prev => new Map(prev).set(productoId, { entradas: [], salidas: [] })); }
    finally { setLoadingMov(prev => { const s = new Set(prev); s.delete(productoId); return s; }); }
  };
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-5">{titulo}</h1>
      <div className="flex flex-wrap gap-3 mb-5">
        <input type="text" value={q} onChange={(e) => { setQ(e.target.value); debounceRef.current?.trigger(); }} placeholder="Buscar codigo o descripcion..."
          className="flex-1 min-w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition" />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)} className="rounded accent-violet-600" />
          Solo con stock
        </label>
      </div>
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3 pl-4 pr-2 w-8"></th>
              <th className="py-3 px-2 w-10"></th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Codigo</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalle</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Packing</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-green-600 uppercase tracking-wide w-20">Entro</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-red-500 uppercase tracking-wide w-20">Salida</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Saldo</th>
              <th className="py-3 pl-3 pr-4 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              const isLoadingMov = loadingMov.has(item.id);
              const mov = movDetalle.get(item.id);
              return (
                <>
                  <tr key={item.id} onClick={() => toggleExpand(item.id)} className={"border-t border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" + (isExpanded ? " bg-slate-50" : "")}>
                    <td className="py-2 pl-4 pr-2 text-slate-400"><ChevronIcon open={isExpanded} /></td>
                    <td className="py-2 px-2"><ProductoThumbnail src={item.imagenUrl} alt={item.codigo} size="sm" /></td>
                    <td className="py-2.5 px-3"><span className="font-semibold text-xs text-violet-600">{item.codigo}</span></td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs"><span className="line-clamp-2 leading-snug text-xs">{item.detalle ?? "---"}</span></td>
                    <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums text-xs">{item.packing ?? "---"}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs font-semibold text-green-600">{item.totalEntradas > 0 ? item.totalEntradas : "---"}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-xs font-semibold text-red-500">{item.totalSalidas > 0 ? item.totalSalidas : "---"}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums">{item.cantidad}</td>
                    <td className="py-2.5 pl-3 pr-4 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setProductoParaAjustar({ id: item.id, codigo: item.codigo })} className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors font-medium">Corregir</button>
                    </td>
                  </tr>
                  {isExpanded && (isLoadingMov
                    ? <tr key={item.id + "-loading"} className="bg-slate-50 border-t border-slate-100"><td colSpan={9} className="py-3 pl-12 pr-4 text-xs text-slate-400 animate-pulse">Cargando movimientos...</td></tr>
                    : mov ? <SubFilasMovimientos key={item.id + "-mov"} mov={mov} /> : null
                  )}
                </>
              );
            })}
            {items.length === 0 && !loading && !error && <tr><td colSpan={9} className="py-12 text-center text-slate-400 text-sm">Sin productos</td></tr>}
            {loading && items.length === 0 && <tr><td colSpan={9} className="py-12 text-center text-slate-400 text-sm">Cargando...</td></tr>}
          </tbody>
        </table>
      </div>
      {nextCursor && (<button onClick={() => { setCursor(nextCursor); cargar(false, nextCursor ?? undefined); }} disabled={loading} className="mt-4 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:border-violet-300 transition-colors disabled:opacity-50">{loading ? "Cargando..." : "Cargar mas"}</button>)}
      {productoParaAjustar && (<AjusteModal productoId={productoParaAjustar.id} productoCodigo={productoParaAjustar.codigo} ubicacion={{ tipo, id: ubicacionId }} onClose={() => setProductoParaAjustar(null)} onSuccess={() => { setProductoParaAjustar(null); cargar(true); }} />)}
    </div>
  );
}