import type { Habit, HabitLog } from '../lib/types';
import { toISODate, addDays, daysBetween } from '../lib/dates';

/**
 * % de cumplimiento de cada hábito en los últimos 30 días (o desde que se
 * creó, si es más reciente que esa ventana). `logs` puede cubrir un rango más
 * amplio que 30 días —se filtra aquí— para poder reutilizar una sola consulta
 * junto con otras estadísticas (racha, mapa de calor).
 */
export function computeHabitCompletionPct(habits: Habit[], logs: HabitLog[], today: Date): Map<string, number> {
  const todayISO = toISODate(today);
  const last30StartISO = toISODate(addDays(today, -29));

  const doneByHabit = new Map<string, number>();
  for (const log of logs) {
    if (log.completed && log.log_date >= last30StartISO) {
      doneByHabit.set(log.habit_id, (doneByHabit.get(log.habit_id) ?? 0) + 1);
    }
  }

  const pctByHabit = new Map<string, number>();
  for (const habit of habits) {
    const createdISO = toISODate(new Date(habit.created_at));
    const effectiveStartISO = createdISO > last30StartISO ? createdISO : last30StartISO;
    const daysConsidered = Math.max(1, daysBetween(effectiveStartISO, todayISO) + 1);
    const done = doneByHabit.get(habit.id) ?? 0;
    pctByHabit.set(habit.id, Math.min(100, Math.round((done / daysConsidered) * 100)));
  }
  return pctByHabit;
}
