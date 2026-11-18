import { z } from "zod";

export const ubicacionInventarioSchema = z.discriminatedUnion("bodega", [
  z.strictObject({
    bodega: z.literal(1),
    planta: z.literal(""),
    pasillo: z.enum(["A1", "A2", "A3", "A4"]),
    posicion: z.enum(["F", "M", "P"]),
  }),
  z.strictObject({
    bodega: z.literal(2),
    planta: z.enum(["ARRIBA", "ABAJO"]),
    pasillo: z.enum(["IZQUIERDA", "DERECHA"]),
    posicion: z.enum(["F", "M", "P"]),
  }),
]);

export type UbicacionInventario = z.infer<typeof ubicacionInventarioSchema>;
export type BodegaInventario = UbicacionInventario["bodega"];

const PLANTAS_B1 = [{ codigo: "", etiqueta: "" }] as const;
const PLANTAS_B2 = [
  { codigo: "ARRIBA", etiqueta: "Arriba" },
  { codigo: "ABAJO", etiqueta: "Abajo" },
] as const;
const PASILLOS_B1 = [
  { codigo: "A1", etiqueta: "A1" },
  { codigo: "A2", etiqueta: "A2" },
  { codigo: "A3", etiqueta: "A3" },
  { codigo: "A4", etiqueta: "A4" },
] as const;
const PASILLOS_B2 = [
  { codigo: "IZQUIERDA", etiqueta: "Izquierda" },
  { codigo: "DERECHA", etiqueta: "Derecha" },
] as const;
const POSICIONES = [
  { codigo: "F", etiqueta: "Fondo" },
  { codigo: "M", etiqueta: "Medio" },
  { codigo: "P", etiqueta: "Principal" },
] as const;

const OPCIONES: Record<BodegaInventario, {
  plantas: readonly { codigo: string; etiqueta: string }[];
  pasillos: readonly { codigo: string; etiqueta: string }[];
}> = {
  1: { plantas: PLANTAS_B1, pasillos: PASILLOS_B1 },
  2: { plantas: PLANTAS_B2, pasillos: PASILLOS_B2 },
};

export function opcionesUbicacion(bodega: BodegaInventario) {
  const { plantas, pasillos } = OPCIONES[bodega];
  return { plantas, pasillos, posiciones: POSICIONES };
}

export function esUbicacionValida(entrada: unknown): entrada is UbicacionInventario {
  return ubicacionInventarioSchema.safeParse(entrada).success;
}

export function claveUbicacion(u: UbicacionInventario): string {
  return `${u.bodega}|${u.planta}|${u.pasillo}|${u.posicion}`;
}

function etiquetaPlanta(planta: string): string {
  const opcion = [...PLANTAS_B2, ...PLANTAS_B1].find((o) => o.codigo === planta);
  return opcion?.etiqueta ?? planta;
}

function etiquetaPasillo(pasillo: string): string {
  const opcion = [...PASILLOS_B1, ...PASILLOS_B2].find((o) => o.codigo === pasillo);
  return opcion?.etiqueta ?? pasillo;
}

function etiquetaPosicion(posicion: string): string {
  return POSICIONES.find((o) => o.codigo === posicion)?.etiqueta ?? posicion;
}

export function etiquetaUbicacion(u: UbicacionInventario): string {
  const partes = [`B${u.bodega}`];
  if (u.planta) partes.push(etiquetaPlanta(u.planta));
  partes.push(etiquetaPasillo(u.pasillo), etiquetaPosicion(u.posicion));
  return partes.join(" · ");
}
