/**
 * Código alternativo ARJ- para productos que no existen en ningún catálogo.
 * Formato: ARJ-YYMMDD-XXX. Alfabeto sin 0/O/1/I para que se lea bien a mano.
 */

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function formatoCodigoArj(fecha: Date, sufijo: string): string {
  const yy = String(fecha.getFullYear() % 100).padStart(2, "0");
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `ARJ-${yy}${mm}${dd}-${sufijo}`;
}

export function sufijoAleatorio(rand: () => number = Math.random): string {
  let sufijo = "";
  for (let i = 0; i < 3; i++) {
    sufijo += ALFABETO[Math.floor(rand() * ALFABETO.length)];
  }
  return sufijo;
}

export function esCodigoArj(codigo: string): boolean {
  return /^ARJ-\d{6}-[A-HJ-NP-Z2-9]{3}$/.test(codigo.trim());
}
