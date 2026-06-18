const MAP: Record<string, string> = {
  GLP: "Bodega 1 Vida Digital",
  GL1: "Bodega 2 Vida Digital",
  GL2: "Bodega 1 Vida Digital", // administrativo, sin bodega física propia
};

/**
 * Mapea el 5° segmento de nroingreso/knumezet a nombre de bodega.
 * Devuelve null para códigos no reconocidos — la capa que llama decide qué hacer.
 */
export function getBodegaPorCodigoIngreso(
  codigo: string | null | undefined
): string | null {
  if (!codigo) return null;
  return MAP[codigo] ?? null;
}
