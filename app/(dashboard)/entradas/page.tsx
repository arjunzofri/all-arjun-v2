"use client";

import { useState, useRef } from "react";
import { crearEntrada } from "@/lib/actions/entradas";
import { BODEGAS } from "@/lib/constants";

// ponytail: form inline sin react-hook-form — un solo formulario, pocas validaciones.

export default function EntradasPage() {
  const [codigo, setCodigo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [bodegaId, setBodegaId] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { codigo: string; detalle: string | null }[]
  >([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const buscar = async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(`/api/productos/buscar-historico?q=${encodeURIComponent(q)}`);
    if (res.ok) setSuggestions(await res.json());
  };

  const handleSearch = (q: string) => {
    setCodigo(q);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => buscar(q), 250);
  };

  const selectProducto = (item: { codigo: string; detalle: string | null }) => {
    setCodigo(item.codigo);
    setDetalle(item.detalle ?? "");
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
      });
      setOk("Entrada registrada");
      setCodigo("");
      setDetalle("");
      setCantidad("");
      setBodegaId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva entrada</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Código + autocompletado */}
        <div className="relative">
          <label className="block text-sm text-gray-700 mb-1">Código</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Buscar producto..."
            autoFocus
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded shadow max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s.codigo}
                  onClick={() => selectProducto(s)}
                  className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                >
                  <span className="font-medium">{s.codigo}</span>
                  {s.detalle && (
                    <span className="text-gray-500 ml-2">{s.detalle}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detalle */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Detalle</label>
          <input
            type="text"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {/* Cantidad */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Cantidad</label>
          <input
            type="number"
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {/* Bodega */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">Bodega destino</label>
          <select
            value={bodegaId}
            onChange={(e) => setBodegaId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar bodega</option>
            {BODEGAS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar entrada"}
        </button>
      </form>
    </div>
  );
}
