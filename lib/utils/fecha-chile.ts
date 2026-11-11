/** Fecha (YYYY-MM-DD) en hora de Chile de un timestamp. */
export function fechaChileDeTimestamp(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Chile. */
export function fechaHoyChile(): string {
  return fechaChileDeTimestamp(new Date());
}

/** "YYYY-MM-DD" (o ISO con hora) → "DD-MM-YYYY", sin pasar por Date. */
export function formatearFechaISO(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

/** Valida YYYY-MM-DD y que sea una fecha real (rechaza 2026-02-31). */
export function esFechaISOValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}
