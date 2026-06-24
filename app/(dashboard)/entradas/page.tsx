"use client";

import { useState, useRef, useEffect } from "react";
import { crearEntrada } from "@/lib/actions/entradas";
import { BODEGAS } from "@/lib/constants";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { createProductoSearch } from "@/components/useProductoSearch";

type Sugerencia = {
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
  packing: number | null;
};

// ── Lógica pura de selección (exportada para test sin jsdom) ──────────

export function applyProductoSugerencia(item: Sugerencia) {
  return {
    codigo: item.codigo,
    detalle: item.detalle ?? "",
    imagenUrl: item.imagenUrl,
    packing: item.packing ?? null, // null = "desconocido", 0 = "sin empaque" — no son intercambiables
    suggestions: [] as never[],
  };
}

// ── Componente ────────────────────────────────────────────────────────

export default function EntradasPage() {
  const [codigo, setCodigo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [packing, setPacking] = useState<number | null>(null);
  const [imagenError, setImagenError] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [bodegaId, setBodegaId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Sugerencia[]>([]);

  const searchRef = useRef<ReturnType<typeof createProductoSearch> | undefined>(undefined);
  if (!searchRef.current) {
    searchRef.current = createProductoSearch({
      fetchFn: async (q) => {
        const res = await fetch(`/api/productos/buscar-historico?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error("fetch error");
        return res.json();
      },
      onResults: setSuggestions,
    });
  }

  const handleSearch = (q: string) => {
    setCodigo(q);
    searchRef.current?.search(q);
  };

  useEffect(() => {
    return () => searchRef.current?.dispose();
  }, []);

  const selectProducto = (item: Sugerencia) => {
    const state = applyProductoSugerencia(item);
    setCodigo(state.codigo);
    setDetalle(state.detalle);
    setImagenUrl(state.imagenUrl);
    setPacking(state.packing);
    setImagenError(false);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");

    if (!codigo || !cantidad || !bodegaId) {
      setError("Completá código, cantidad y bodega");
      return;
    }

    setLoading(true);
    try {
      await crearEntrada({
        codigo: codigo.trim().toUpperCase(),
        detalle: detalle.trim() || undefined,
        cantidad: parseInt(cantidad, 10),
        bodegaId: parseInt(bodegaId, 10),
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        imagenUrl: imagenUrl ?? undefined,
        packing: packing ?? undefined,
        observaciones: observaciones.trim() || undefined,
      });
      setOk("Entrada registrada");
      setCodigo("");
      setDetalle("");
      setImagenUrl(null);
      setPacking(null);
      setObservaciones("");
      setImagenError(false);
      setCantidad("");
      setBodegaId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva entrada</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Código + autocompletado */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Código</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
            placeholder="Buscar producto..."
            autoFocus
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded shadow max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s.codigo}
                  onClick={() => selectProducto(s)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-violet-50 cursor-pointer transition-colors"
                >
                  <ProductoThumbnail src={s.imagenUrl} alt="" size="sm" />
                  <div className="min-w-0">
                    <span className="font-medium">{s.codigo}</span>
                    {s.detalle && (
                      <span className="text-gray-500 ml-2 truncate">{s.detalle}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Imagen post-selección */}
        {imagenUrl && (
          <div className="flex items-center gap-3 p-3 rounded border bg-gray-50">
            <ProductoThumbnail
              src={imagenError ? null : imagenUrl}
              alt={codigo}
              size="lg"
              fallbackText="Sin imagen"
              onError={() => setImagenError(true)}
            />
            <span className="text-sm font-medium text-gray-900">{codigo}</span>
          </div>
        )}

        {/* Detalle */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Detalle</label>
          <input
            type="text"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad</label>
          <input
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
          />
        </div>

        {/* Bodega */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Bodega destino</label>
          <select
            value={bodegaId}
            onChange={(e) => setBodegaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
          >
            <option value="">Seleccionar bodega</option>
            {BODEGAS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm resize-y outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
            placeholder="Opcional"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar entrada"}
        </button>
      </form>
    </div>
  );
}

