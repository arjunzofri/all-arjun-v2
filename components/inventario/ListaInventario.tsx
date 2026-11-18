import Link from "next/link";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { formatearFechaChile } from "@/lib/utils/fecha-chile";
import { etiquetaUbicacion, type UbicacionInventario } from "@/lib/inventario/ubicaciones";
import type { FilaInventario, PosicionContada } from "@/lib/inventario/consultas";

// Cast puntual: el schema de DB restringe estas columnas a los valores del union.
const ubicacion = (p: PosicionContada) => etiquetaUbicacion({ bodega: p.bodega, planta: p.planta, pasillo: p.pasillo, posicion: p.posicion } as UbicacionInventario);

const Codigo = ({ fila }: { fila: FilaInventario }) => (
  <div className="min-w-0">
    <Link href={`/productos/${fila.id}`} className="block break-all text-sm font-medium text-violet-700 hover:underline">{fila.codigo}</Link>
    {fila.codigoPersonal && <span className="block break-all text-xs text-slate-500">Alias: {fila.codigoPersonal}</span>}
  </div>
);
const Ubicaciones = ({ fila }: { fila: FilaInventario }) => fila.posiciones.length === 0
  ? <span className="text-xs text-slate-400">Sin posiciones contadas</span>
  : <ul className="space-y-1">{fila.posiciones.map((p) => <li key={p.id} className="break-words text-xs text-slate-600">{ubicacion(p)}</li>)}</ul>;
const Stock = ({ fila }: { fila: FilaInventario }) => (
  <div className="space-y-1">
    <span className="block text-sm font-medium text-slate-800">{fila.stockContado === null ? "Sin contar" : `Total contado: ${fila.stockContado} u.`}</span>
    {fila.posiciones.length === 0
      ? <span className="block text-xs text-slate-400">Sin posiciones contadas</span>
      : <ul className="space-y-1">{fila.posiciones.map((p) => <li key={p.id} className="break-words text-xs text-slate-600">{`${ubicacion(p)} · ${p.cantidad} u. · ${formatearFechaChile(p.creadoEn)} · ${p.usuario}`}</li>)}</ul>}
  </div>
);

export default function ListaInventario({ items }: { items: FilaInventario[] }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-slate-500">Sin resultados.</p>;
  return (
    <>
      <div className="hidden lg:block"><table className="w-full text-left">
        <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <th className="w-16 py-3 pr-3">Imagen</th><th className="py-3 pr-3">Código</th><th className="py-3 pr-3">Ubicación</th><th className="py-3">Stock</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{items.map((fila) => (
          <tr key={fila.id}>
            <td className="py-5 pr-3 align-top"><ProductoThumbnail src={fila.imagenUrl} alt={fila.codigo} size="sm" /></td>
            <td className="py-5 pr-3 align-top"><Codigo fila={fila} /></td>
            <td className="py-5 pr-3 align-top"><Ubicaciones fila={fila} /></td>
            <td className="py-5 align-top"><Stock fila={fila} /></td>
          </tr>
        ))}</tbody>
      </table></div>
      <ul className="space-y-3 lg:hidden">{items.map((fila) => (
        <li key={fila.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3"><ProductoThumbnail src={fila.imagenUrl} alt={fila.codigo} size="sm" /><Codigo fila={fila} /></div>
          <div className="mt-3"><Stock fila={fila} /></div>
        </li>
      ))}</ul>
    </>
  );
}
