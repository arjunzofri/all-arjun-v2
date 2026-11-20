"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const MAX_CORRIDAS = 30;
export const MSG_EN_CURSO = "Sincronización en curso. Intenta en unos minutos.";
export const MSG_ERROR = "No se pudo actualizar las compras. Intenta nuevamente.";

type FetchLike = (
  url: string,
  init: { method: string },
) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>;

export type Resultado = {
  estado: "ok" | "ocupado" | "error";
  insertadas: number;
  corridas: number;
};

/**
 * El navegador exige que `fetch` se invoque con this global/undefined; pasarlo
 * suelto a crearActualizador hace que `deps.fetch(...)` lo llame como metodo.
 */
export function crearDepsActualizar(alProgresar?: (insertadas: number) => void) {
  return {
    fetch: (url: string, init: { method: string }) => fetch(url, init),
    alProgresar,
  };
}

/** Encadena corridas mientras el server reporte pendientes; doble clic comparte la cadena. */
export function crearActualizador(deps: {
  fetch: FetchLike;
  alProgresar?: (insertadas: number) => void;
}) {
  let enVuelo: Promise<Resultado> | null = null;

  const correr = async (): Promise<Resultado> => {
    let insertadas = 0;
    for (let i = 0; i < MAX_CORRIDAS; i++) {
      let res: Awaited<ReturnType<FetchLike>>;
      try {
        res = await deps.fetch("/api/sync/compras-anil", { method: "POST" });
      } catch {
        return { estado: "error", insertadas, corridas: i };
      }
      if (res.status === 409) return { estado: "ocupado", insertadas, corridas: i };
      if (!res.ok) return { estado: "error", insertadas, corridas: i };
      const data = (await res.json().catch(() => ({}))) as {
        pendientes?: boolean;
        insertadas?: number;
      };
      insertadas += data.insertadas ?? 0;
      deps.alProgresar?.(insertadas);
      if (!data.pendientes) return { estado: "ok", insertadas, corridas: i + 1 };
    }
    return { estado: "ok", insertadas, corridas: MAX_CORRIDAS };
  };

  return () => {
    if (!enVuelo) enVuelo = correr().finally(() => { enVuelo = null; });
    return enVuelo;
  };
}

export default function ActualizarCompras() {
  const router = useRouter();
  const [fase, setFase] = useState<"idle" | "corriendo" | "listo" | "ocupado" | "error">("idle");
  const [insertadas, setInsertadas] = useState(0);
  const [actualizador] = useState(() => crearActualizador(crearDepsActualizar(setInsertadas)));

  const onClick = async () => {
    setFase("corriendo");
    setInsertadas(0);
    const r = await actualizador();
    setInsertadas(r.insertadas);
    setFase(r.estado === "ok" ? "listo" : r.estado);
    if (r.estado === "ok") router.refresh();
  };

  const corriendo = fase === "corriendo";
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={corriendo}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {corriendo ? "Actualizando compras..." : fase === "error" ? "Reintentar" : "ACTUALIZAR"}
      </button>
      {corriendo && <p className="text-xs text-slate-500">{insertadas} compras nuevas</p>}
      {fase === "ocupado" && <p className="text-xs text-amber-600">{MSG_EN_CURSO}</p>}
      {fase === "error" && <p className="text-xs text-red-600">{MSG_ERROR}</p>}
    </div>
  );
}
