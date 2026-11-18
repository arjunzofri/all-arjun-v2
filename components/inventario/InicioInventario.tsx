import Link from "next/link";
import BuscadorInventario from "@/components/inventario/BuscadorInventario";

export default function InicioInventario({ username, mostrarIdentificacion }: {
  username: string; mostrarIdentificacion: boolean;
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
    </section>
  );
}
