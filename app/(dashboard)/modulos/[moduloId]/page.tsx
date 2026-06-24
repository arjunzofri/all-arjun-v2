import { UbicacionDetalle } from "../../components/UbicacionDetalle";
import { getNombreUbicacion } from "@/lib/actions/vistas";

export default async function ModuloDetalle({
  params,
}: {
  params: Promise<{ moduloId: string }>;
}) {
  const { moduloId } = await params;
  const nombre = await getNombreUbicacion("modulo", Number(moduloId));
  return <UbicacionDetalle tipo="modulo" nombre={nombre} />;
}