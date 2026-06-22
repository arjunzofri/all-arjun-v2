import Link from "next/link";
import { getModulos } from "@/lib/actions/vistas";

export const dynamic = "force-dynamic";

export default async function ModulosPage() {
  const modulos = await getModulos();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Módulos</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modulos.map((m) => (
          <Link
            key={m.id}
            href={`/modulos/${m.id}`}
            className="rounded-lg border p-4 hover:bg-gray-50 transition"
          >
            <h2 className="font-semibold text-gray-900">{m.nombre}</h2>
            <p className="text-2xl font-bold text-gray-700 mt-2">
              {m.totalStock}
            </p>
            <p className="text-sm text-gray-500">unidades en stock</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
