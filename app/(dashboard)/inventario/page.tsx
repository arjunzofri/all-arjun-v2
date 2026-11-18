import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import { listarInventario, type FilaInventario } from "@/lib/inventario/consultas";
import ListaInventario from "@/components/inventario/ListaInventario";

export const dynamic = "force-dynamic";
type ParametrosCrudos = { q?: string | string[]; cursor?: string | string[] };
type ParametrosLista = { ok: true; q: string; cursor: number | null } | { ok: false; error: string };
const ERROR_PAGINA = "Parámetro de página inválido.", MAX_INT4 = 2147483647;

/** Valida y normaliza los search params de la lista. Puro, sin DB. */
export function leerParametrosLista(sp: ParametrosCrudos): ParametrosLista {
  if (sp.q !== undefined && typeof sp.q !== "string") return { ok: false, error: "Parámetro de búsqueda inválido." };
  if (sp.cursor !== undefined && typeof sp.cursor !== "string") return { ok: false, error: ERROR_PAGINA };
  const q = (sp.q ?? "").trim();
  if (q.length > 100) return { ok: false, error: "El texto de búsqueda supera 100 caracteres." };
  const cursorCrudo = sp.cursor ?? "";
  if (cursorCrudo === "") return { ok: true, q, cursor: null };
  const cursor = Number(cursorCrudo);
  if (!/^[1-9]\d*$/.test(cursorCrudo) || cursor > MAX_INT4) return { ok: false, error: ERROR_PAGINA };
  return { ok: true, q, cursor };
}

function Vista({ error, children }: { error?: string; children?: React.ReactNode }) {
  return <div><h1 className="mb-6 text-2xl font-bold text-slate-900">Inventario</h1>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div> : children}</div>;
}

export default async function InventarioPage({ searchParams }: { searchParams: Promise<ParametrosCrudos> }) {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");
  if (!flagActivo("inventario_bodega")) redirect("/productos");
  const params = leerParametrosLista(await searchParams);
  if (!params.ok) return <Vista error={params.error} />;
  let items: FilaInventario[], nextCursor: number | null;
  try {
    const resultado = await listarInventario({ q: params.q, limit: 20, ...(params.cursor === null ? {} : { cursor: params.cursor }) });
    items = resultado.items; nextCursor = resultado.nextCursor;
  } catch {
    return <Vista error="No se pudo obtener el inventario. Intente nuevamente." />;
  }
  const qEnc = encodeURIComponent(params.q);
  return <Vista>
    {params.q !== "" && <p className="mb-4 break-words text-sm text-slate-600">Resultados para “{params.q}” · <Link href="/inventario" className="font-medium text-violet-700 hover:underline">Ver todo</Link></p>}
    <ListaInventario items={items} />
    <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
      {nextCursor !== null && <Link href={`/inventario?q=${qEnc}&cursor=${nextCursor}`} className="rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-violet-700 hover:bg-slate-50">Ver más</Link>}
      {params.cursor !== null && <Link href={`/inventario?q=${qEnc}`} className="rounded-lg border border-slate-200 px-4 py-2.5 font-medium text-slate-600 hover:bg-slate-50">Volver al inicio de la lista</Link>}
    </div>
  </Vista>;
}
