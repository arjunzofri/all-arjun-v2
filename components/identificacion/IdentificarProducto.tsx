"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CamaraBoton } from "@/components/CamaraBoton";
import { comprimirImagen, miniaturaCloudinary } from "@/lib/utils/comprimir-imagen";
import { generarCodigoAlternativo } from "@/lib/actions/identificacion";

type Opcion = { codigo: string; codigos: string[]; detalle: string | null; imagenUrl: string; razon: string; fuente?: "visual" | "preseleccion" };
type Resultado = { opciones: Opcion[]; avisos?: string[] };

const ERROR_GENERICO = "No se pudo identificar el producto. Intenta de nuevo.";
const BOTON_USAR = "mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors";

export function segundosTranscurridos(inicioMs: number, ahoraMs: number): number {
  return Math.max(0, Math.floor((ahoraMs - inicioMs) / 1000));
}

export function AvisoAnalizando({ segundos }: { segundos: number }) {
  return (
    <div role="status" className="mt-4 flex items-center gap-3 rounded-lg bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-700">
      <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
      <div>
        <p>Analizando la foto...</p>
        <p className="text-xs text-violet-500">Llevamos {segundos} s · puede tardar hasta 45 s</p>
      </div>
    </div>
  );
}

export default function IdentificarProducto() {
  const router = useRouter();
  const [foto, setFoto] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [elegidos, setElegidos] = useState<Record<number, string>>({});
  const [creandoCodigo, setCreandoCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState("");
  const [segundos, setSegundos] = useState(0);
  const fotoRef = useRef<string | null>(null);
  useEffect(() => () => { if (fotoRef.current) URL.revokeObjectURL(fotoRef.current); }, []);

  useEffect(() => {
    if (!analizando) return;
    const inicio = Date.now();
    const id = setInterval(() => setSegundos(segundosTranscurridos(inicio, Date.now())), 250);
    return () => clearInterval(id);
  }, [analizando]);

  const handleFoto = async (file: File) => {
    if (analizando) return;
    if (fotoRef.current) URL.revokeObjectURL(fotoRef.current);
    fotoRef.current = URL.createObjectURL(file);
    setFoto(fotoRef.current); setError(""); setResultado(null); setSegundos(0); setAnalizando(true);
    try {
      const { data, mimeType } = await comprimirImagen(file);
      const res = await fetch("/api/identificacion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, mimeType }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setError(json?.error ?? ERROR_GENERICO);
      if (!json?.opciones) return setError(ERROR_GENERICO);
      setResultado(json as Resultado);
      setElegidos(Object.fromEntries((json.opciones as Opcion[]).map((o, i) => [i, o.codigo])));
    } catch { setError(ERROR_GENERICO); } finally { setAnalizando(false); }
  };

  const crearCodigoNuevo = async () => {
    setCreandoCodigo(true); setErrorCodigo("");
    try {
      const { codigo } = await generarCodigoAlternativo();
      router.push(`/entradas?codigo=${encodeURIComponent(codigo)}&nuevo=1`);
    } catch (err) {
      setErrorCodigo(err instanceof Error ? err.message : "No se pudo crear el código");
      setCreandoCodigo(false);
    }
  };

  const reiniciar = () => {
    if (fotoRef.current) URL.revokeObjectURL(fotoRef.current);
    fotoRef.current = null;
    setFoto(null); setResultado(null); setError(""); setElegidos({});
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Identificar producto</h1>
      <div className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white">
        {foto && (
          <div className="relative w-40 h-40 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <img src={foto} alt="Foto del producto" className="w-full h-full object-cover" />
            {analizando && <div aria-hidden="true" className="escaner-laser" />}
          </div>
        )}
        <CamaraBoton onFoto={handleFoto} disabled={analizando} className="!p-5 rounded-2xl bg-violet-600 !text-white hover:!bg-violet-700" />
        <span className="text-sm font-medium text-slate-700">Sacar foto del producto</span>
      </div>

      {analizando && <AvisoAnalizando segundos={segundos} />}
      {error && (
        <div role="alert" className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {resultado && !analizando && (
        <div className="mt-6 space-y-3">
          {resultado.avisos?.some((a) => a.includes("comparación visual no disponible")) && (
            <p className="text-xs text-amber-700">Resultado rápido: la comparación por imagen no alcanzó a terminar. Revisa bien antes de elegir.</p>
          )}
          {resultado.opciones.length === 0 && <p className="text-sm text-slate-600">No encontramos productos parecidos en la foto.</p>}
          {resultado.opciones.map((op, i) => {
            const elegido = elegidos[i] ?? op.codigo;
            return (
              <div key={`${op.codigo}-${i}`} className="flex gap-3 p-3 rounded-xl border border-slate-200 bg-white shadow-sm">
                <img src={miniaturaCloudinary(op.imagenUrl, 160)} alt={op.codigo}
                  className="w-16 h-16 rounded-lg object-contain bg-white border border-slate-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-sm font-semibold text-slate-900">{elegido}</span>
                  {op.detalle && <p className="text-xs text-slate-600 truncate">{op.detalle}</p>}
                  {op.fuente === "preseleccion" && <span className="inline-block mt-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Otra posibilidad</span>}
                  <p className="text-xs text-slate-500 mt-1">{op.razon}</p>
                  {op.codigos.length > 1 && op.codigos.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-xs text-slate-700 mt-1">
                      <input type="radio" name={`codigos-${i}`} checked={elegido === c}
                        onChange={() => setElegidos((s) => ({ ...s, [i]: c }))} />
                      <span className="font-mono">{c}</span>
                    </label>
                  ))}
                  <button type="button" className={BOTON_USAR}
                    onClick={() => router.push(`/entradas?codigo=${encodeURIComponent(elegido)}`)}>Usar este código</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 space-y-3 text-center">
        <p className="text-sm text-slate-500">¿Ninguno es el producto?</p>
        <Link href="/entradas" className="inline-block text-sm font-medium text-violet-600 hover:underline">Buscar manualmente</Link>
        <div>
          <button type="button" onClick={crearCodigoNuevo} disabled={creandoCodigo}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50">
            {creandoCodigo ? "Creando código..." : "Crear código nuevo"}
          </button>
          {errorCodigo && <p role="alert" className="mt-2 text-xs text-red-600">{errorCodigo}</p>}
        </div>
        <div>
          <button type="button" onClick={reiniciar}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Sacar otra foto
          </button>
        </div>
      </div>
    </div>
  );
}
