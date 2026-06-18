"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { getStockPorBodega } from "@/lib/actions/vistas";

type Item = { id: number; codigo: string; detalle: string | null; packing: number | null; cantidad: number };

export default function BodegaDetallePage() {
  const { bodegaId } = useParams<{ bodegaId: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [soloConStock, setSoloConStock] = useState(true);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(
    async (reset?: boolean) => {
      setLoading(true);
      const page = await getStockPorBodega({
        bodegaId: Number(bodegaId),
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
    [bodegaId, cursor, q, soloConStock]
  );

  useEffect(() => {
    setItems([]);
    setCursor(null);
    cargar(true);
  }, [bodegaId, q, soloConStock]);

  const cargarMas = () => {
    if (nextCursor) {
      setCursor(nextCursor);
      cargar();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Bodega {bodegaId}
      </h1>

      <div className="flex gap-4 mb-4">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
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
                <td className="py-2 text-right text-gray-500">
                  {item.packing ?? "—"}
                </td>
                <td className="py-2 text-right font-semibold">
                  {item.cantidad}
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  Sin productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <button
          onClick={cargarMas}
          disabled={loading}
          className="mt-4 w-full rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </div>
  );
}
