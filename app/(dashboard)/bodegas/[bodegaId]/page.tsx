import { UbicacionDetalle } from "../../components/UbicacionDetalle";
import { getNombreUbicacion } from "@/lib/actions/vistas";

export default async function BodegaDetalle({
  params,
}: {
  params: Promise<{ bodegaId: string }>;
}) {
  const { bodegaId } = await params;
  const nombre = await getNombreUbicacion("bodega", Number(bodegaId));
  return <UbicacionDetalle tipo="bodega" nombre={nombre} />;
}