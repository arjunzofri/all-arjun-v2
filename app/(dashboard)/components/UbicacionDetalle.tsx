"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getStockPorUbicacion } from "@/lib/actions/vistas";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { AjusteModal } from "@/components/AjusteModal";

type Item = { id: number; codigo: string; detalle: string | null; imagenUrl: string | null; packing: number | null; cantidad: number };
type Tipo = "bodega" | "modulo";
type Page = { items: Item[]; nextCursor: number | null };

// ── Lógica pura de debounce (exportada para test sin jsdom) ───────────

export function createDebounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    trigger() {
      clearTimeout(timer);
      timer = setTimeout(fn, ms);
    },
    cancel() {
      clearTimeout(timer);
    },
  };
}

// ── Lógica pura de carga con error handling (exportada para test) ────

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
    config.onError(
      err instanceof Error ? err : new Error(String(err)),
    );
  } finally {
    config.onSettled();
  }
}

// ── Componente ────────────────────────────────────────────────────────

export function UbicacionDetalle({ tipo }: { tipo: Tipo }) {
  const params = useParams();
  const ubicacionId = Number(params[tipo === "bodega" ? "bodegaId" : "moduloId"]);
  const label = tipo === "bodega" ? "Bodega" : "Módulo";

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
        load: () =>
          getStockPorUbicacion({
            tipo,
            ubicacionId,
            limit: 20,
            cursor: reset ? undefined : (cursor ?? undefined),
            q: q || undefined,
            soloConStock,
          }),
        reset,
        onSuccess: (page, isReset) => {
          if (isReset) {
            setItems(page.items);
          } else {
            setItems((prev) => [...prev, ...page.items]);
          }
          setNextCursor(page.nextCursor);
          setError(null);
        },
        onError: (err) => setError(err.message),
        onSettled: () => setLoading(false),
      });
    },
    [tipo, ubicacionId, cursor, q, soloConStock],
  );

  // Ref siempre actualizado con el último cargar (q/cursor/soloConStock)
  const cargarRef = useRef(cargar);
  cargarRef.current = cargar;

  // Debounce para el input de búsqueda — creado una sola vez
  const debounceRef = useRef<ReturnType<typeof createDebounce> | undefined>(undefined);
  if (!debounceRef.current) {
    debounceRef.current = createDebounce(() => {
      setItems([]);
      setCursor(null);
      cargarRef.current(true);
    }, 250);
  }

  // Cambios que disparan cargar inmediatamente (sin debounce):
  // navegación entre ubicaciones + toggle "Solo con stock"
  useEffect(() => {
    debounceRef.current?.cancel();
    setItems([]);
    setCursor(null);
    cargar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, ubicacionId, soloConStock]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => debounceRef.current?.cancel();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        {label} {ubicacionId}
      </h1>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            debounceRef.current?.trigger();
          }}
          placeholder="Buscar código o descripción..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(e) => setSoloConStock(e.target.checked)}
            className="rounded"
          />
          Solo con stock
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 w-8"></th>
              <th className="py-2">Código</th>
              <th className="py-2">Detalle</th>
              <th className="py-2 text-right">Packing</th>
              <th className="py-2 text-right">Stock</th>
              <th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="py-1">
                  <ProductoThumbnail src={item.imagenUrl} alt={item.codigo} size="sm" />
                </td>
                <td className="py-2 font-medium">{item.codigo}</td>
                <td className="py-2 text-gray-600">{item.detalle ?? "—"}</td>
                <td className="py-2 text-right text-gray-500">{item.packing ?? "—"}</td>
                <td className="py-2 text-right font-semibold">{item.cantidad}</td>
                <td className="py-2 text-center">
                  <button
                    onClick={() => setProductoParaAjustar({ id: item.id, codigo: item.codigo })}
                    className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700"
                  >
                    Corregir
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && !error && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">Sin productos</td>
              </tr>
            )}
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">Cargando...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          onClick={() => { setCursor(nextCursor); cargar(); }}
          disabled={loading}
          className="mt-4 w-full rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Cargar más"}
        </button>
      )}

      {productoParaAjustar && (
        <AjusteModal
          productoId={productoParaAjustar.id}
          productoCodigo={productoParaAjustar.codigo}
          ubicacion={{ tipo, id: ubicacionId }}
          usuarioId={1}
          onClose={() => setProductoParaAjustar(null)}
          onSuccess={() => {
            setProductoParaAjustar(null);
            cargar(true);
          }}
        />
      )}
    </div>
  );
}
