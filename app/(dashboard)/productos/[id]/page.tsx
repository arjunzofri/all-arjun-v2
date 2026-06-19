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

      <EditarProductoForm producto={producto} />
    </div>
  );
}
