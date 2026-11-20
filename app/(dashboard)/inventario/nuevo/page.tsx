import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import NuevoProducto from "@/components/inventario/NuevoProducto";

export const dynamic = "force-dynamic";

export default async function NuevoPage({ searchParams }: { searchParams: Promise<{ codigo?: string | string[] }> }) {
  const sesion = await auth();
  if (!sesion?.user) redirect("/login");
  if (!flagActivo("inventario_bodega")) redirect("/productos");
  const { codigo } = await searchParams;
  return <NuevoProducto codigoInicial={typeof codigo === "string" ? codigo.trim().slice(0, 30) : ""} />;
}
