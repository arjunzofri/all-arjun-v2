"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getStockPorUbicacion } from "@/lib/actions/vistas";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { AjusteModal } from "@/components/AjusteModal";

type Item = { id: number; codigo: string; detalle: string | null; imagenUrl: string | null; packing: number | null; cantidad: number };
type Tipo = "bodega" | "modulo";
type Page = { items: Item[]; nextCursor: number | null };

export function createDebounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    trigger() { clearTimeout(timer); timer = setTimeout(fn, ms); },
    cancel()  { clearTimeout(timer); },
  };
}

type ExecuteLoadConfig = {
  load: () => Promise<Page>;
  reset?: boolean;
  onSuccess: (result: Page, reset?: boolean) => void;
  onError: (error: Error) => void;
  onSettled: () => void;
};

export async function executeLoad(config: ExecuteLoadConfig) {
  try {
    const result = await config.load();
    config.onSuccess(result, config.reset);
  } catch (err) {
    config.onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    config.onSettled();
  }
}

export function UbicacionDetalle({ tipo }: { tipo: Tipo }) {
  const params = useParams();
  const ubicacionId = Number(params[tipo === "bodega" ? "bodegaId" : "moduloId"]);
  const label = tipo === "bodega" ? "Bodega" : "Modulo";

  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productoParaAjustar, setProductoParaAjustar] = useState<{ id: number; codigo: string } | null>(null);

  const cargar = useCallback(
    async (reset?: boolean) => {
      setLoading(true);
      await executeLoad({
        load: () => getStockPorUbicacion({
          tipo, ubicacionId, limit: 20,
          cursor: reset ? undefined : (cursor ?? undefined),
          q: q || undefined, soloConStock,
        }),
        reset,
        onSuccess: (page, isReset) => {
          if (isReset) { setItems(page.items); } else { setItems((prev) => [...prev, ...page.items]); }
          setNextCursor(page.nextCursor);
          setError(null);
        },
        onError: (err) => setError(err.message),
        onSettled: () => setLoading(false),
      });
    },
    [tipo, ubicacionId, cursor, q, soloConStock],
  );

  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  const debounceRef = useRef<ReturnType<typeof createDebounce> | undefined>(undefined);
  if (!debounceRef.current) {
    debounceRef.current = createDebounce(() => {
      setItems([]); setCursor(null); cargarRef.current(true);
    }, 250);
  }

  useEffect(() => {
    debounceRef.current?.cancel();
    setItems([]); setCursor(null); cargar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ubicacionId, soloConStock]);

  useEffect(() => { return () => debounceRef.current?.cancel(); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-5">
        {label} {ubicacionId}
      </h1>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); debounceRef.current?.trigger(); }}
          placeholder="Buscar codigo o descripcion..."
          className="flex-1 min-w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(e) => setSoloConStock(e.target.checked)}
            className="rounded accent-violet-600"
          />
          Solo con stock
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-3 pl-4 pr-2 w-10"></th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Codigo</th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalle</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Packing</th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Stock</th>
              <th className="py-3 pl-3 pr-4 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-2 pl-4 pr-2">
                  <ProductoThumbnail src={item.imagenUrl} alt={item.codigo} size="sm" />
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-xs text-violet-600">{item.codigo}</span>
                </td>
                <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                  <span className="line-clamp-2 leading-snug text-xs">{item.detalle ?? "---"}</span>
                </td>
                <td className="py-2.5 px-3 text-right text-slate-500 tabular-nums text-xs">
                  {item.packing ?? "---"}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums">
                  {item.cantidad}
                </td>
                <td className="py-2.5 pl-3 pr-4 text-center">
                  <button
                    onClick={() => setProductoParaAjustar({ id: item.id, codigo: item.codigo })}
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors font-medium"
                  >
                    Corregir
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">Sin productos</td>
              </tr>
            )}
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">Cargando...</td>
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

      {productoParaAjustar && (
        <AjusteModal
          productoId={productoParaAjustar.id}
          productoCodigo={productoParaAjustar.codigo}
          ubicacion={{ tipo, id: ubicacionId }}
          onClose={() => setProductoParaAjustar(null)}
          onSuccess={() => { setProductoParaAjustar(null); cargar(true); }}
        />
      )}
    </div>
  );
}