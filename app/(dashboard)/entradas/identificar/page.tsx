import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { flagActivo } from "@/lib/feature-flags";
import IdentificarProducto from "@/components/identificacion/IdentificarProducto";

export const dynamic = "force-dynamic";

export default async function IdentificarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!flagActivo("identificacion_foto")) notFound();
  return <IdentificarProducto />;
}
