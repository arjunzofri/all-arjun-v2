import Link from "next/link";
import { getBodegas } from "@/lib/actions/vistas";

export const dynamic = "force-dynamic";

export default async function BodegasPage() {
  const bodegas = await getBodegas();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Bodegas</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bodegas.map((b) => (
          <Link
            key={b.id}
            href={`/bodegas/${b.id}`}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all"
          >
            <h2 className="font-semibold text-slate-700 text-sm mb-3">{b.nombre}</h2>
            <p className="text-3xl font-bold text-violet-600">
              {b.totalStock.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400 mt-1">unidades en stock</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
