/**
 * Formateo de valores para las vistas de inversión. Los costos de Vida
 * Digital (precdocd) están en USD; se muestran con prefijo explícito para
 * no confundirlos con CLP.
 */

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const moneda = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearNumero(n: number): string {
  return numero.format(n);
}

export function formatearMoneda(n: number): string {
  return `USD ${moneda.format(n)}`;
}

export function formatearPromedio(n: number | null): string {
  return n === null ? "—" : formatearMoneda(n);
}

/** "YYYY-MM-DD" (o ISO con hora) → "DD-MM-YYYY". Invalida → "—". */
export function formatearFecha(fecha: string | null): string {
  if (fecha === null) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(fecha);
  if (!m) return "—";
  return `${m[3]}-${m[2]}-${m[1]}`;
}
