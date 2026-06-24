"use client";

import { useState, useRef, useEffect } from "react";
import { crearEntrada } from "@/lib/actions/entradas";
import { BODEGAS } from "@/lib/constants";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { CamaraBoton } from "@/components/CamaraBoton";
import { createProductoSearch } from "@/components/useProductoSearch";

type Sugerencia = {
  codigo: string;
  detalle: string | null;
  imagenUrl: string | null;
  packing: number | null;
};

export function applyProductoSugerencia(item: Sugerencia) {
  return {
    codigo: item.codigo,
    detalle: item.detalle ?? "",
    imagenUrl: item.imagenUrl,
    packing: item.packing ?? null,
    suggestions: [] as never[],
  };
}

export function resolverFoto(
  state: { esDeCatalogo: boolean; codigo: string; imagenUrl: string | null; fotoLocal: string | null },
  objectUrl: string
): { fotoLocal: string } {
  return { fotoLocal: objectUrl };
}

export function aplicarSugerencia(imagenUrl: string | null) {
  return { esDeCatalogo: true as const, imagenUrl, fotoLocal: null as null };
}

export function marcarManual() {
  return { esDeCatalogo: false as const };
}

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
  const [esDeCatalogo, setEsDeCatalogo] = useState(false);
  const [fotoLocal, setFotoLocal] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoLocalRef = useRef<string | null>(null);

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
    setEsDeCatalogo(false);
    searchRef.current?.search(q);
  };

  useEffect(() => {
    return () => {
      searchRef.current?.dispose();
      if (fotoLocalRef.current) URL.revokeObjectURL(fotoLocalRef.current);
    };
  }, []);

  const selectProducto = (item: Sugerencia) => {
    const state = applyProductoSugerencia(item);
    setCodigo(state.codigo);
    setDetalle(state.detalle);
    setImagenUrl(state.imagenUrl);
    setPacking(state.packing);
    setImagenError(false);
    setSuggestions([]);
    setEsDeCatalogo(true);
    if (fotoLocalRef.current) { URL.revokeObjectURL(fotoLocalRef.current); fotoLocalRef.current = null; }
    setFotoLocal(null);
    setFotoFile(null);
  };

  const handleFoto = async (file: File) => {
    if (fotoLocalRef.current) URL.revokeObjectURL(fotoLocalRef.current);
    const objectUrl = URL.createObjectURL(file);
    fotoLocalRef.current = objectUrl;
    setFotoFile(file);
    setFotoLocal(objectUrl);

    if (esDeCatalogo) return;
    if (!codigo.trim()) return;

    setUploadingFoto(true);
    try {
      const searchRes = await fetch(`/api/productos/buscar-historico?q=${encodeURIComponent(codigo.trim())}`);
      if (!searchRes.ok) throw new Error();
      const resultados = await searchRes.json() as Sugerencia[];
      const match = resultados.find(r => r.codigo.toUpperCase() === codigo.trim().toUpperCase());
      if (!match) return;

      const prodRes = await fetch(`/api/productos?q=${encodeURIComponent(match.codigo)}&limit=1`);
      if (!prodRes.ok) throw new Error();
      const prodData = await prodRes.json() as { items: { id: number; codigo: string }[] };
      const prod = prodData.items.find(p => p.codigo.toUpperCase() === match.codigo.toUpperCase());
      if (!prod) return;

      const formData = new FormData();
      formData.append("imagen", file);
      const uploadRes = await fetch(`/api/productos/${prod.id}/imagen`, { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error();
      const uploadData = await uploadRes.json() as { imagenUrl: string };
      setImagenUrl(uploadData.imagenUrl);
    } catch { /* no bloquear */ } finally {
      setUploadingFoto(false);
    }
  };

  const limpiarFoto = () => {
    if (fotoLocalRef.current) { URL.revokeObjectURL(fotoLocalRef.current); fotoLocalRef.current = null; }
    setFotoLocal(null); setFotoFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setOk("");
    if (!codigo || !cantidad || !bodegaId) { setError("Completa codigo, cantidad y bodega"); return; }
    if (uploadingFoto) { setError("Espera que la foto termine de subirse"); return; }
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
      setCodigo(""); setDetalle(""); setImagenUrl(null); setPacking(null);
      setObservaciones(""); setImagenError(false); setCantidad(""); setBodegaId("");
      setEsDeCatalogo(false); limpiarFoto();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar");
    } finally { setLoading(false); }
  };

  const imagenPreview = (!esDeCatalogo && fotoLocal) ? fotoLocal : (imagenError ? null : imagenUrl);
  const hayImagen = !!(imagenUrl || fotoLocal);

  return (
    <div className="max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Nueva entrada</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">Codigo</label>
            <div className="flex items-center gap-1">
              {uploadingFoto && <span className="text-xs text-slate-400 animate-pulse">Subiendo foto...</span>}
              <CamaraBoton onFoto={handleFoto} disabled={uploadingFoto} />
            </div>
          </div>
          <input type="text" value={codigo} onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition"
            placeholder="Buscar producto..." autoFocus />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
              {suggestions.map((s) => (
                <li key={s.codigo} onClick={() => selectProducto(s)}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-violet-50 cursor-pointer transition-colors">
                  <ProductoThumbnail src={s.imagenUrl} alt="" size="sm" />
                  <div className="min-w-0">
                    <span className="font-medium">{s.codigo}</span>
                    {s.detalle && <span className="text-slate-400 ml-2 text-xs truncate">{s.detalle}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hayImagen && (
          <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
            {imagenPreview
              ? <img src={imagenPreview} alt={codigo} className="w-12 h-12 rounded-lg object-contain bg-white border border-slate-200" onError={() => setImagenError(true)} />
              : <ProductoThumbnail src={null} alt={codigo} size="lg" fallbackText="Sin imagen" />}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-800">{codigo}</span>
              {fotoLocal && !esDeCatalogo && <p className="text-xs text-violet-600 mt-0.5">Foto guardada</p>}
              {fotoLocal && esDeCatalogo && <p className="text-xs text-amber-500 mt-0.5">Foto descartada (producto del catalogo)</p>}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Detalle</label>
          <input type="text" value={detalle} onChange={(e) => setDetalle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Cantidad</label>
          <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Bodega destino</label>
          <select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition">
            <option value="">Seleccionar bodega</option>
            {BODEGAS.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Observaciones</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
            maxLength={500} rows={2} placeholder="Opcional"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm resize-y outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 transition" />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">{error}</div>}
        {ok && <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-sm text-green-700">{ok}</div>}

        <button type="submit" disabled={loading || uploadingFoto}
          className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50">
          {loading ? "Registrando..." : uploadingFoto ? "Esperando foto..." : "Registrar entrada"}
        </button>
      </form>
    </div>
  );
}