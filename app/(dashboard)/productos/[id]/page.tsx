import Link from "next/link";
import { getProducto } from "@/lib/actions/productos";
import { notFound } from "next/navigation";
import { EditarProductoForm } from "./form";
import { ImagenProducto } from "./imagen";

export function buildVolverHref(refQ: string | undefined): string {
  if (!refQ) return "/productos";
  return `/productos?q=${encodeURIComponent(refQ)}`;
}

export default async function ProductoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ refQ?: string }>;
}) {
  const [{ id }, { refQ }] = await Promise.all([params, searchParams]);
  const producto = await getProducto(Number(id));

  if (!producto) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href={buildVolverHref(refQ)}
        className="inline-block mb-4 text-sm text-gray-500 hover:text-gray-900"
      >
        ← Volver a productos
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {producto.codigo}
      </h1>

      <div className="grid gap-6 sm:grid-cols-2">
        <ImagenProducto
          productoId={producto.id}
          imagenUrl={producto.imagenUrl}
        />

        <div className="space-y-2 text-sm">
          <p>
            <span className="text-gray-500">Código:</span>{" "}
            <span className="font-medium">{producto.codigo}</span>
          </p>
          <p>
            <span className="text-gray-500">Detalle:</span>{" "}
            {producto.detalle ?? "—"}
          </p>
          <p>
            <span className="text-gray-500">Código personal:</span>{" "}
            {producto.codigoPersonal ?? "—"}
          </p>
          <p>
            <span className="text-gray-500">Packing:</span>{" "}
            {producto.packing ?? "—"} unids/caja
          </p>
          <p>
            <span className="text-gray-500">Ubicación:</span>{" "}
            {producto.ubicacion ?? "—"}
          </p>
          <p>
            <span className="text-gray-500">Observaciones:</span>{" "}
            {producto.observaciones ?? "—"}
          </p>
        </div>
      </div>

      <hr className="my-6" />

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Stock</h2>
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <h3 className="font-medium text-gray-500 mb-2">Bodegas</h3>
          {producto.bodegas?.length > 0
            ? producto.bodegas.map(
                (b: { id: number; nombre: string; cantidad: number }) => (
                  <p key={b.id} className="text-gray-700">
                    {b.nombre}: {b.cantidad} uds
                  </p>
                )
              )
            : <p className="text-gray-400">—</p>}
        </div>
        <div>
          <h3 className="font-medium text-gray-500 mb-2">Módulos</h3>
          {producto.modulos?.length > 0
            ? producto.modulos.map(
                (m: { id: number; nombre: string; cantidad: number }) => (
                  <p key={m.id} className="text-gray-700">
                    {m.nombre}: {m.cantidad} uds
                  </p>
                )
              )
            : <p className="text-gray-400">—</p>}
        </div>
      </div>

      <hr className="my-6" />

      <EditarProductoForm producto={producto} />
    </div>
  );
}
