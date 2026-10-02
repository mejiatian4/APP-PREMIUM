// Utilidades de fechas. Trabajamos siempre con la fecha LOCAL del usuario
// (no UTC) para evitar que un hábito marcado de noche "salte" de día.

/** Formatea una fecha como 'YYYY-MM-DD' usando la fecha local. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Devuelve el lunes (00:00) de la semana que contiene la fecha dada. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0=domingo, 1=lunes, ... 6=sábado. Queremos que el lunes sea el inicio.
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // si es domingo, retrocede 6 días
  d.setDate(d.getDate() + diff);
  return d;
}

/** Devuelve los 7 días (lunes..domingo) de la semana que empieza en `monday`. */
export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Suma (o resta) semanas a una fecha. */
export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

/** Suma (o resta) días a una fecha. */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** ¿Las dos fechas son el mismo día? */
export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

/** Diferencia en días completos entre dos fechas ISO 'YYYY-MM-DD' (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
  return Math.round((new Date(bISO).getTime() - new Date(aISO).getTime()) / 86_400_000);
}

/**
 * Índice del día de la semana empezando en lunes (0=lunes..6=domingo), mismo
 * orden que DAY_LABELS/DAY_NAMES. Distinto de Date.getDay() nativo
 * (0=domingo..6=sábado) — este es el único punto de conversión entre ambos.
 */
export function mondayFirstDay(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Etiquetas cortas de los días, empezando en lunes. */
export const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Nombres accesibles de los días (para lectores de pantalla y tooltips). */
export const DAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

/** Pone en mayúscula la primera letra (p. ej. para nombres de mes/día en español). */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Formatea 'YYYY-MM-DD' como "15 ago 2026", sin desfases de zona horaria. */
export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '');
}

/** Rango legible de la semana, p. ej. "23 – 29 jun 2026". */
export function formatWeekRange(monday: Date): string {
  const days = weekDays(monday);
  const sunday = days[6];
  const fmtDay = (d: Date) => d.getDate();
  const month = (d: Date) =>
    d.toLocaleDateString('es', { month: 'short' }).replace('.', '');

  if (monday.getMonth() === sunday.getMonth()) {
    return `${fmtDay(monday)} – ${fmtDay(sunday)} ${month(sunday)} ${sunday.getFullYear()}`;
  }
  return `${fmtDay(monday)} ${month(monday)} – ${fmtDay(sunday)} ${month(sunday)} ${sunday.getFullYear()}`;
}
