import type { AgendaItem } from '../lib/types';
import { mondayFirstDay, DAY_NAMES } from '../lib/dates';

/**
 * ¿Este ítem tiene una ocurrencia programada en la fecha dada ('YYYY-MM-DD')?
 * Convertimos la fecha a un Date local (nunca `new Date(stringISO)` directo,
 * que se interpreta en UTC y puede correr el día según la zona horaria).
 */
export function occursOn(item: AgendaItem, dateISO: string): boolean {
  if (dateISO < item.start_date) return false;
  if (item.end_date && dateISO > item.end_date) return false;

  if (item.recurrence === 'once') return dateISO === item.start_date;
  if (item.recurrence === 'daily') return true;

  const [y, m, d] = dateISO.split('-').map(Number);
  return item.weekdays.includes(mondayFirstDay(new Date(y, m - 1, d)));
}

/** Ítems que ocurren en `dateISO`, ordenados por hora. */
export function occurrencesForDate(items: AgendaItem[], dateISO: string): AgendaItem[] {
  return items
    .filter((item) => occursOn(item, dateISO))
    .sort((a, b) => a.time_of_day.slice(0, 5).localeCompare(b.time_of_day.slice(0, 5)));
}

const SHORT_DAY_NAMES = DAY_NAMES.map((name) => name.slice(0, 3));

/** Resumen legible de la regla de repetición, p. ej. "Lun, Mié" o "Todos los días". */
export function describeRecurrence(item: AgendaItem): string {
  if (item.recurrence === 'daily') return 'Todos los días';
  if (item.recurrence === 'weekly') {
    return [...item.weekdays].sort((a, b) => a - b).map((d) => SHORT_DAY_NAMES[d]).join(', ');
  }
  return 'Una vez';
}
