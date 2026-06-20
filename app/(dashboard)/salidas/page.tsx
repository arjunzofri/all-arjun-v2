"use client";

import { useState, useRef, useEffect } from "react";
import { crearSalida } from "@/lib/actions/salidas";
import { BODEGAS, MODULOS } from "@/lib/constants";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { createProductoSearch } from "@/components/useProductoSearch";

export default function SalidasPage() {
  const [bodegaId, setBodegaId] = useState("");
  const [moduloId, setModuloId] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { codigo: string; detalle: string | null; imagenUrl: string | null; cantidad: number }[]
  >([]);

  const bodegaRef = useRef(bodegaId);
  bodegaRef.current = bodegaId;

  const searchRef = useRef<ReturnType<typeof createProductoSearch> | undefined>(undefined);
  if (!searchRef.current) {
    searchRef.current = createProductoSearch({
      fetchFn: async (q) => {
        const res = await fetch(
          `/api/productos/por-bodega?bodegaId=${bodegaRef.current}&q=${encodeURIComponent(q)}`
        );
        if (!res.ok) throw new Error("fetch error");
        return res.json();
      },
      onResults: setSuggestions,
      guard: () => !!bodegaRef.current,
    });
  }

  const handleSearch = (q: string) => {
    setCodigo(q);
    searchRef.current?.search(q);
  };

  useEffect(() => {
    return () => searchRef.current?.dispose();
  }, []);

  const selectProducto = (item: {
    codigo: string;
    detalle: string | null;
    cantidad: number;
  }) => {
    setCodigo(item.codigo);
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");

    if (!codigo || !cantidad || !bodegaId || !moduloId) {
      setError("Completá todos los campos");
      return;
    }

    setLoading(true);
    try {
      const result = await crearSalida({
        codigo: codigo.trim().toUpperCase(),
        cantidad: parseInt(cantidad, 10),
        bodegaOrigenId: parseInt(bodegaId, 10),
        moduloDestinoId: parseInt(moduloId, 10),
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        usuarioId: 1, // ponytail: hardcode hasta que haya sesión real en client
      });

      if (result.ok === false) {
        setError("Salida ya registrada (idempotente)");
      } else {
        setOk(`Salida registrada — stock descontado`);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva salida</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bodega origen */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Bodega origen
          </label>
          <select
            value={bodegaId}
            onChange={(e) => {
              setBodegaId(e.target.value);
              setCodigo("");
              setSuggestions([]);
            }}
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

        {/* Producto */}
        <div className="relative">
          <label className="block text-sm text-gray-700 mb-1">Producto</label>
          <input
            type="text"
            value={codigo}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Buscar producto..."
            disabled={!bodegaId}
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border rounded shadow max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li
                  key={s.codigo}
                  onClick={() => selectProducto(s)}
                  className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                >
                  <span className="flex items-center gap-2">
                    <ProductoThumbnail src={s.imagenUrl} alt="" size="sm" />
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

        {/* Módulo destino */}
        <div>
          <label className="block text-sm text-gray-700 mb-1">
            Módulo destino
          </label>
          <select
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
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

        {error && <p className="text-sm text-red-600">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar salida"}
        </button>
      </form>
    </div>
  );
}
