import Link from "next/link";
import { getBodegas } from "@/lib/actions/vistas";

export default async function BodegasPage() {
  const bodegas = await getBodegas();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bodegas</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bodegas.map((b) => (
          <Link
            key={b.id}
            href={`/bodegas/${b.id}`}
            className="rounded-lg border p-4 hover:bg-gray-50 transition"
          >
            <h2 className="font-semibold text-gray-900">{b.nombre}</h2>
            <p className="text-2xl font-bold text-gray-700 mt-2">
              {b.totalStock}
            </p>
            <p className="text-sm text-gray-500">unidades en stock</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
