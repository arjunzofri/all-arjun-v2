"use client";

import { useState, useRef } from "react";
import { crearRetorno } from "@/lib/actions/retornos";
import { BODEGAS, MODULOS } from "@/lib/constants";

export default function RetornosPage() {
  const [moduloId, setModuloId] = useState("");
  const [bodegaId, setBodegaId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { codigo: string; detalle: string | null; cantidad: number }[]
  >([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const buscar = async (q: string) => {
    if (q.length < 2 || !moduloId) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(
      `/api/productos/por-bodega?bodegaId=${moduloId}&tipo=modulo&q=${encodeURIComponent(q)}`
    );
    if (res.ok) {
      const data = await res.json();
      setSuggestions(data.items ?? []);
    }
  };

  const handleSearch = (q: string) => {
    setCodigo(q);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => buscar(q), 250);
  };

  const selectProducto = (item: { codigo: string }) => {
    setCodigo(item.codigo);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");

    if (!codigo || !cantidad || !moduloId || !bodegaId) {
      setError("Completá todos los campos");
      return;
    }

    setLoading(true);
    try {
      const result = await crearRetorno({
        codigo: codigo.trim().toUpperCase(),
        cantidad: parseInt(cantidad, 10),
        moduloOrigenId: parseInt(moduloId, 10),
        bodegaDestinoId: parseInt(bodegaId, 10),
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        usuarioId: 1,
      });

      if (result.ok === false) {
        setError("Retorno ya registrado (idempotente)");
      } else {
        setOk("Retorno registrado");
        setCodigo("");
        setCantidad("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo retorno</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Módulo origen */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Módulo origen
          </label>
          <select
            value={moduloId}
            onChange={(e) => {
              setModuloId(e.target.value);
              setCodigo("");
              setSuggestions([]);
            }}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Seleccionar módulo</option>
            {MODULOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Producto */}
        <div className="relative">
          <label className="block text-sm text-gray-700 mb-1">Producto</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Buscar producto..."
            disabled={!moduloId}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded shadow max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s.codigo}
                  onClick={() => selectProducto(s)}
                  className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer flex justify-between"
                >
                  <span>
                    <span className="font-medium">{s.codigo}</span>
                    {s.detalle && (
                      <span className="text-gray-500 ml-2">{s.detalle}</span>
                    )}
                  </span>
                  <span className="text-gray-400">Stock: {s.cantidad}</span>
                </li>
              ))}
            </ul>
          )}
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

        {/* Bodega destino */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Bodega destino
          </label>
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
          {loading ? "Registrando..." : "Registrar retorno"}
        </button>
      </form>
    </div>
  );
}
