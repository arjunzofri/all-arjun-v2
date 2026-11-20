"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProducto } from "@/lib/actions/productos";
import type { FilaInventario } from "@/lib/inventario/consultas";

type Campos = { codigoPersonal: string; packing: string; observaciones: string };
type Payload = { codigoPersonal?: string; packing?: number; observaciones?: string };
type Resultado = { ok: true } | { ok: false; error: string };

/** Puro: sin clave ubicacion; vacio = clave omitida (no cambiar); packing no numerico => null. */
export function construirPayload(c: Campos): Payload | null {
  const payload: Payload = {};
  const codigoPersonal = c.codigoPersonal.trim();
  const packing = c.packing.trim();
  const observaciones = c.observaciones.trim();
  if (codigoPersonal) payload.codigoPersonal = codigoPersonal;
  if (packing) {
    const numero = Number(packing);
    if (Number.isNaN(numero)) return null;
    payload.packing = numero;
  }
  if (observaciones) payload.observaciones = observaciones;
  return payload;
}

/** Cerrojo sincronico: dos clics concurrentes hacen una sola llamada. */
export function crearGuardar(accion: typeof updateProducto) {
  let ocupado = false;
  return async (id: number, campos: Campos): Promise<Resultado | null> => {
    if (ocupado) return null;
    const payload = construirPayload(campos);
    if (payload === null) return { ok: false, error: "El packing debe ser un entero mayor que 0" };
    if (Object.keys(payload).length === 0) return null;
    ocupado = true;
    try {
      const r = await accion(id, payload);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    } catch {
      return { ok: false, error: "No se pudieron guardar los cambios. Intente nuevamente." };
    } finally {
      ocupado = false;
    }
  };
}

export function EditorFichaProducto({ fila }: { fila: Pick<FilaInventario, "id" | "codigoPersonal" | "packing" | "observaciones"> }) {
  const router = useRouter();
  const guardar = useMemo(() => crearGuardar(updateProducto), []);
  const [campos, setCampos] = useState<Campos>({
    codigoPersonal: fila.codigoPersonal ?? "",
    packing: fila.packing === null ? "" : String(fila.packing),
    observaciones: fila.observaciones ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<Resultado | null>(null);
  const onClick = async () => {
    setGuardando(true);
    try {
      const r = await guardar(fila.id, campos);
      setAviso(r);
      if (r?.ok) router.refresh();
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {[
        { clave: "codigoPersonal" as const, label: "Código personal" },
        { clave: "packing" as const, label: "Packing" },
        { clave: "observaciones" as const, label: "Observaciones" },
      ].map(({ clave, label }) => (
        <label key={clave} className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
          <input value={campos[clave]} onChange={(e) => setCampos({ ...campos, [clave]: e.target.value })}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
        </label>
      ))}
      {aviso && (
        <p role={aviso.ok ? "status" : "alert"} className={`text-sm ${aviso.ok ? "text-green-700" : "text-red-600"}`}>
          {aviso.ok ? "Cambios guardados correctamente" : aviso.error}
        </p>
      )}
      <button type="button" onClick={onClick} disabled={guardando}
        className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
        {guardando ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
