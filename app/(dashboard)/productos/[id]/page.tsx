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

  const compras = ("compras" in producto)
    ? (producto as { compras: { id: number; folio: string; fecha: string | null; cantidad: number; bodega: string; visaciones: { nroIngreso: string; cantidad: number }[] }[] }).compras
    : [];

  return (
    <div className="max-w-3xl space-y-6">

      {/* Breadcrumb */}
      <Link
        href={buildVolverHref(refQ)}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Volver a productos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-widest mb-1">Producto</p>
          <h1 className="text-3xl font-bold text-slate-900">{producto.codigo}</h1>
          {producto.detalle && (
            <p className="mt-1.5 text-sm text-slate-500 max-w-lg leading-relaxed">{producto.detalle}</p>
          )}
        </div>
      </div>

      {/* Grid principal: imagen + info */}
      <div className="grid gap-5 sm:grid-cols-2">

        {/* Imagen */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <ImagenProducto productoId={producto.id} imagenUrl={producto.imagenUrl} />
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 space-y-0 divide-y divide-slate-100">
          {[
            { label: "Codigo", value: producto.codigo },
            { label: "Codigo personal", value: producto.codigoPersonal ?? "---" },
            { label: "Packing", value: producto.packing ? `${producto.packing} unids/caja` : "---" },
            { label: "Ubicacion", value: producto.ubicacion ?? "---" },
            { label: "Observaciones", value: producto.observaciones ?? "---" },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-baseline gap-4 py-2.5">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide shrink-0">{label}</span>
              <span className="text-sm text-slate-800 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stock */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stock</h2>
        </div>
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Bodegas</h3>
            {producto.bodegas?.length > 0 ? (
              <div className="space-y-2">
                {producto.bodegas.map((b: { id: number; nombre: string; cantidad: number }) => (
                  <div key={b.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{b.nombre}</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">{b.cantidad} <span className="text-xs font-normal text-slate-400">uds</span></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">---</p>}
          </div>
          <div className="p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Modulos</h3>
            {producto.modulos?.length > 0 ? (
              <div className="space-y-2">
                {producto.modulos.map((m: { id: number; nombre: string; cantidad: number }) => (
                  <div key={m.id} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{m.nombre}</span>
                    <span className="text-sm font-bold text-slate-800 tabular-nums">{m.cantidad} <span className="text-xs font-normal text-slate-400">uds</span></span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">---</p>}
          </div>
        </div>
      </div>

      {/* Compras */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Historial de compras</h2>
        </div>
        {compras.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pl-5 pr-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">NV</th>
                  <th className="py-3 px-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Fecha</th>
                  <th className="py-3 px-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Bodega</th>
                  <th className="py-3 pl-3 pr-5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compras.map((c) => (
                  <>
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pl-5 pr-3 font-semibold text-slate-800">{c.folio}</td>
                      <td className="py-3 px-3 text-slate-500 tabular-nums">
                        {c.fecha ? new Date(c.fecha).toLocaleDateString("es-CL") : "---"}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{c.bodega}</td>
                      <td className="py-3 pl-3 pr-5 text-right font-bold text-slate-800 tabular-nums">{c.cantidad}</td>
                    </tr>
                    {c.visaciones.length > 0 && (
                      <tr key={`${c.id}-vis`} className="bg-slate-50">
                        <td colSpan={4} className="py-2 pl-5 pr-5">
                          <div className="flex flex-wrap gap-2">
                            {c.visaciones.map((v, i) => (
                              <span key={i} className="inline-flex items-center gap-1 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                                <span className="text-slate-400">NI</span> {v.nroIngreso}
                                <span className="text-slate-300 mx-0.5">·</span>
                                <span className="font-medium text-slate-600">{v.cantidad}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-sm text-slate-400">Sin compras registradas</p>
        )}
      </div>

      {/* Editar */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Editar producto</h2>
        </div>
        <div className="p-5">
          <EditarProductoForm producto={producto} />
        </div>
      </div>

    </div>
  );
}