export const MAX_INT4 = 2147483647;
export type RetornoLista = { q: string; cursor: number | null; valores: boolean };
export type CrudosLista = { refQ?: string | string[]; refCursor?: string | string[]; refValores?: string | string[] };
export const SIN_RETORNO: RetornoLista = { q: "", cursor: null, valores: false };

/** Valida por campo el contexto que llega desde la ficha. Puro, sin DB. */
export function leerRetorno(sp: CrudosLista, esAdmin = false): RetornoLista {
  const q = typeof sp.refQ === "string" ? sp.refQ.trim() : "";
  const cursorCrudo = typeof sp.refCursor === "string" ? sp.refCursor : "";
  const cursor = /^[1-9]\d*$/.test(cursorCrudo) && Number(cursorCrudo) <= MAX_INT4 ? Number(cursorCrudo) : null;
  return { q: q.length > 100 ? "" : q, cursor, valores: esAdmin && sp.refValores === "1" };
}

/** Link de /inventario con q, cursor y valores=1 solo cuando corresponde. */
export function hrefLista({ q, cursor, valores }: RetornoLista): string {
  const termino = q.trim();
  const partes = [termino !== "" ? `q=${encodeURIComponent(termino)}` : "", cursor !== null ? `cursor=${cursor}` : "", valores ? "valores=1" : ""].filter(Boolean);
  return partes.length === 0 ? "/inventario" : `/inventario?${partes.join("&")}`;
}

/** Link de /productos/{id} con el contexto de retorno a la lista. */
export function hrefFicha(id: number, { q, cursor, valores }: RetornoLista = SIN_RETORNO): string {
  const termino = q.trim();
  const partes = [termino !== "" ? `refQ=${encodeURIComponent(termino)}` : "", cursor !== null ? `refCursor=${cursor}` : "", valores ? "refValores=1" : ""].filter(Boolean);
  return partes.length === 0 ? `/productos/${id}` : `/productos/${id}?${partes.join("&")}`;
}
