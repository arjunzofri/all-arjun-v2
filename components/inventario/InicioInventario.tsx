import Link from "next/link";
import BuscadorInventario from "@/components/inventario/BuscadorInventario";
import ActualizarCompras from "@/components/inventario/ActualizarCompras";
import { formatearFechaChile, formatearFechaISO, formatearHoraChile } from "@/lib/utils/fecha-chile";
import type { EstadoCompras } from "@/lib/sync/estado-compras";

export default function InicioInventario({ username, mostrarIdentificacion, estadoCompras }: {
  username: string; mostrarIdentificacion: boolean; estadoCompras?: EstadoCompras | null;
}) {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 py-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Inventario de bodega</p>
      <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">¿Qué producto vas a contar?</h1>
      <p className="text-sm text-slate-500">Hola, {username}.</p>
      <div className="w-full text-left"><BuscadorInventario grande /></div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
        <Link href="/inventario" className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700">Ver todo el inventario</Link>
        {mostrarIdentificacion && (
          <Link href="/entradas/identificar" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:border-violet-300 hover:text-violet-700">Identificar por foto</Link>
        )}
      </div>
      {estadoCompras !== undefined && (
        <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-800">Compras</h2>
            <ActualizarCompras />
          </div>
          {estadoCompras?.ultima ? (
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <p>
                Última actualización: {formatearFechaChile(estadoCompras.ultima.createdAt)}{" "}
                {formatearHoraChile(estadoCompras.ultima.createdAt)}
              </p>
              {estadoCompras.ultima.ok ? (
                <p>
                  Actualización correcta: {estadoCompras.ultima.insertadas ?? 0} compras nuevas
                  ({estadoCompras.ultima.procesadas ?? 0} procesadas)
                </p>
              ) : (
                <p className="text-red-600">Error en la última actualización</p>
              )}
              {estadoCompras.watermark && (
                <p>Compras al: {formatearFechaISO(estadoCompras.watermark)}</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Aún no se han importado compras</p>
          )}
        </div>
      )}
    </section>
  );
}
