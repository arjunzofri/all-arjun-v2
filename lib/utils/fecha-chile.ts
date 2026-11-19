/** Fecha (YYYY-MM-DD) en hora de Chile de un timestamp. */
export function fechaChileDeTimestamp(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(d);
}

/** Fecha de hoy (YYYY-MM-DD) en hora de Chile. */
export function fechaHoyChile(): string {
  return fechaChileDeTimestamp(new Date());
}

/** Timestamp ISO → "DD-MM-YYYY" en hora de Chile; inválida → "—". */
export function formatearFechaChile(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Timestamp ISO → "HH:mm" (h23) en hora de Chile; inválida → "—". */
export function formatearHoraChile(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
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
