import Link from "next/link";
import { ProductoThumbnail } from "@/components/ProductoThumbnail";
import { formatearFechaChile, formatearHoraChile } from "@/lib/utils/fecha-chile";
import { formatearFecha, formatearMoneda, formatearNumero, formatearPromedio } from "@/lib/utils/inversion-formato";
import { etiquetaUbicacion, type UbicacionInventario } from "@/lib/inventario/ubicaciones";
import type { ValorizacionCodigo } from "@/lib/inventario/valorizacion";
import type { FilaInventario, PosicionContada, ValorizacionLista } from "@/lib/inventario/consultas";

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
    <span className="block text-sm font-medium text-slate-800">{fila.stockContado === null ? "Sin contar" : `Total contado: ${formatearNumero(fila.stockContado)} u.`}</span>
    {fila.posiciones.length === 0
      ? <span className="block text-xs text-slate-400">Sin posiciones contadas</span>
      : <ul className="space-y-1">{fila.posiciones.map((p) => <li key={p.id} className="break-words text-xs text-slate-600">{`${ubicacion(p)} · ${formatearNumero(p.cantidad)} u. · ${formatearFechaChile(p.creadoEn)} ${formatearHoraChile(p.creadoEn)} · ${p.usuario}`}</li>)}</ul>}
  </div>
);

const Valor = ({ v }: { v: ValorizacionCodigo | undefined }) => (
  <span className="block space-y-1">
    <span className="block text-sm font-medium text-slate-800">{v ? formatearMoneda(v.valorTotal) : "—"}</span>
    {v && v.cantidadSinCosto > 0 && <span className="block text-xs text-amber-600">{formatearNumero(v.cantidadSinCosto)} u. sin costo</span>}
  </span>
);
const rangoConteos = (min: string, max: string) => min === max ? `Conteo: ${formatearFecha(min)}` : `Conteos: ${formatearFecha(min)} a ${formatearFecha(max)}`;

export default function ListaInventario({ items, valores = null, errorValores = false }: { items: FilaInventario[]; valores?: ValorizacionLista | null; errorValores?: boolean }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-slate-500">Sin resultados.</p>;
  const porId = new Map(valores?.porProducto.map((p) => [p.productoId, p.valor]));
  const conValores = valores !== null;
  return (
    <>
      <div className="hidden lg:block"><table className="w-full text-left">
        <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <th className="w-16 py-3 pr-3">Imagen</th><th className="py-3 pr-3">Código</th><th className="py-3 pr-3">Ubicación</th><th className="py-3">Stock</th>
          {conValores && <><th className="py-3 pr-3">Costo prom.</th><th className="py-3">Valor</th></>}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{items.map((fila) => (
          <tr key={fila.id}>
            <td className="py-5 pr-3 align-top"><ProductoThumbnail src={fila.imagenUrl} alt={fila.codigo} size="sm" /></td>
            <td className="py-5 pr-3 align-top"><Codigo fila={fila} /></td>
            <td className="py-5 pr-3 align-top"><Ubicaciones fila={fila} /></td>
            <td className="py-5 align-top"><Stock fila={fila} /></td>
            {conValores && <>
              <td className="py-5 pr-3 align-top text-sm text-slate-700">{formatearPromedio(porId.get(fila.id)?.costoPromedio ?? null)}</td>
              <td className="py-5 align-top"><Valor v={porId.get(fila.id)} /></td>
            </>}
          </tr>
        ))}</tbody>
      </table></div>
      <ul className="space-y-3 lg:hidden">{items.map((fila) => (
        <li key={fila.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3"><ProductoThumbnail src={fila.imagenUrl} alt={fila.codigo} size="sm" /><Codigo fila={fila} /></div>
          <div className="mt-3"><Stock fila={fila} /></div>
          {conValores && <div className="mt-2 space-y-1 break-words text-sm text-slate-700">
            <p>Costo prom.: {formatearPromedio(porId.get(fila.id)?.costoPromedio ?? null)}</p>
            <p>Valor: <Valor v={porId.get(fila.id)} /></p>
          </div>}
        </li>
      ))}</ul>
      {errorValores
        ? <p className="mt-6 text-center text-sm text-red-600">No se pudo cargar la valorización. Intente nuevamente.</p>
        : valores && <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-semibold text-slate-800">Inversión según últimos conteos: {formatearMoneda(valores.totales.valorTotal)}</p>
          {valores.totales.fechaMin !== null && <p className="text-xs text-slate-500">{rangoConteos(valores.totales.fechaMin, valores.totales.fechaMax ?? valores.totales.fechaMin)}</p>}
          {valores.totales.fechasDistintas && <p className="text-xs text-amber-600">Los conteos tienen fechas distintas.</p>}
          {valores.totales.incompleto && <p className="text-xs text-amber-600">Valorización incompleta: {formatearNumero(valores.totales.unidadesSinCosto)} unidades sin costo</p>}
        </div>}
    </>
  );
}
