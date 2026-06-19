"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getStockPorUbicacion } from "@/lib/actions/vistas";

type Item = { id: number; codigo: string; detalle: string | null; packing: number | null; cantidad: number };
type Tipo = "bodega" | "modulo";

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

  const cargar = useCallback(
    async (reset?: boolean) => {
      setLoading(true);
      const page = await getStockPorUbicacion({
        tipo,
        ubicacionId,
        limit: 20,
        cursor: reset ? undefined : (cursor ?? undefined),
        q: q || undefined,
        soloConStock,
      });
      if (reset) {
        setItems(page.items);
      } else {
        setItems((prev) => [...prev, ...page.items]);
      }
      setNextCursor(page.nextCursor);
      setLoading(false);
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Código</th>
              <th className="py-2">Detalle</th>
              <th className="py-2 text-right">Packing</th>
              <th className="py-2 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="py-2 font-medium">{item.codigo}</td>
                <td className="py-2 text-gray-600">{item.detalle ?? "—"}</td>
                <td className="py-2 text-right text-gray-500">{item.packing ?? "—"}</td>
                <td className="py-2 text-right font-semibold">{item.cantidad}</td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">Sin productos</td>
              </tr>
            )}
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">Cargando...</td>
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
    </div>
  );
}
