import Link from "next/link";
import { getProductos } from "@/lib/actions/productos";

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const { q, cursor } = await searchParams;
  const { items, nextCursor } = await getProductos({
    q,
    limit: 20,
    cursor: cursor ? Number(cursor) : undefined,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Productos</h1>

      <form className="mb-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar código o descripción..."
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Buscar
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2">Código</th>
              <th className="py-2">Detalle</th>
              <th className="py-2">Pack</th>
              <th className="py-2">Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="py-2">
                  <Link
                    href={`/productos/${p.id}`}
                    className="font-medium text-gray-900 hover:underline"
                  >
                    {p.codigo}
                  </Link>
                </td>
                <td className="py-2 text-gray-600">{p.detalle ?? "—"}</td>
                <td className="py-2 text-gray-500">{p.packing ?? "—"}</td>
                <td className="py-2 text-gray-500">{p.ubicacion ?? "—"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  Sin productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nextCursor && (
        <div className="mt-4 text-center">
          <Link
            href={`/productos?q=${q ?? ""}&cursor=${nextCursor}`}
            className="text-sm text-gray-600 hover:underline"
          >
            Siguiente página →
          </Link>
        </div>
      )}
    </div>
  );
}
