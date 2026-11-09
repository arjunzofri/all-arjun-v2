import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import {
  getStockPorCodigo,
  getLotesCompraPorCodigos,
} from "@/lib/utils/inversion-lotes";
import { calcularResumenInversion } from "@/lib/utils/inversion-resumen";
import {
  formatearMoneda,
  formatearNumero,
} from "@/lib/utils/inversion-formato";
import TablaInversion from "@/components/inversion/TablaInversion";

export const dynamic = "force-dynamic";

type SesionInversion = { user?: { role?: string } | null } | null;

export type AccesoInversion = "login" | "no-encontrado" | "ok";

/** Orden: sesión → flag → rol admin. No consulta datos por sí sola. */
export function resolverAccesoInversion(
  sesion: SesionInversion,
  flag: boolean
): AccesoInversion {
  if (!sesion?.user) return "login";
  if (!flag) return "no-encontrado";
  if (sesion.user.role !== "admin") return "no-encontrado";
  return "ok";
}

export default async function InversionMercaderiaPage() {
  const session = await auth();
  const acceso = resolverAccesoInversion(
    session as SesionInversion,
    flagActivo("inversion_mercaderia")
  );

  if (acceso === "login") redirect("/login");
  if (acceso === "no-encontrado") notFound();

  const stockPorCodigo = await getStockPorCodigo();
  const lotesPorCodigo = await getLotesCompraPorCodigos([
    ...stockPorCodigo.keys(),
  ]);
  const resumen = calcularResumenInversion(stockPorCodigo, lotesPorCodigo);
  const { totales } = resumen;

  const cards = [
    { label: "Inversión total", value: formatearMoneda(totales.valorTotal) },
    { label: "Unidades en stock", value: formatearNumero(totales.unidades) },
    { label: "Unidades sin costo", value: formatearNumero(totales.unidadesSinCosto) },
    {
      label: "Códigos con stock",
      value: formatearNumero(totales.codigosConStock),
      sub: `${formatearNumero(totales.codigosSinCompras)} sin compras`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">
        Inversión en mercadería
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {c.label}
            </p>
            <p className="text-2xl font-bold text-violet-600 mt-2 tabular-nums">
              {c.value}
            </p>
            {c.sub && <p className="text-xs text-slate-400 mt-1">{c.sub}</p>}
          </div>
        ))}
      </div>

      <TablaInversion resumen={resumen} />
    </div>
  );
}
