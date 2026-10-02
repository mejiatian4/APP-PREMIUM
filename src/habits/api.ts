import { supabase } from '../lib/supabase';
import type { Habit, HabitLog } from '../lib/types';

// ---------------------------------------------------------------------------
//  Hábitos (CRUD)
// ---------------------------------------------------------------------------

/** Lista los hábitos del usuario, ordenados por posición y fecha de creación. */
export async function listHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Crea un hábito nuevo. `position` lo dejamos al final de la lista. */
export async function createHabit(
  userId: string,
  name: string,
  color: string,
  position: number,
): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({ user_id: userId, name, color, position })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza el nombre y/o color de un hábito.
 * El filtro por `userId` (además de `id`) es puro cinturón y tirantes: RLS ya
 * impide tocar hábitos ajenos, esto solo evita depender de una sola capa.
 */
export async function updateHabit(
  id: string,
  userId: string,
  fields: Partial<Pick<Habit, 'name' | 'color' | 'position'>>,
): Promise<void> {
  const { error } = await supabase.from('habits').update(fields).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Elimina un hábito. Sus registros se borran en cascada (ver schema.sql). */
export async function deleteHabit(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
//  Registros de cumplimiento
// ---------------------------------------------------------------------------

/** Trae los registros del usuario entre dos fechas (inclusive), formato 'YYYY-MM-DD'. */
export async function getLogsForRange(
  startISO: string,
  endISO: string,
): Promise<HabitLog[]> {
  const { data, error } = await supabase
    .from('habit_logs')
    .select('*')
    .gte('log_date', startISO)
    .lte('log_date', endISO);

  if (error) throw error;
  return data ?? [];
}

/**
 * Marca o desmarca un hábito en una fecha.
 * - Marcar  -> upsert de la fila (completed = true).
 * - Desmarcar -> borra la fila (ausencia = no realizado), manteniendo la tabla limpia.
 */
export async function setCompletion(
  userId: string,
  habitId: string,
  dateISO: string,
  completed: boolean,
): Promise<void> {
  if (completed) {
    const { error } = await supabase
      .from('habit_logs')
      .upsert(
        { user_id: userId, habit_id: habitId, log_date: dateISO, completed: true },
        { onConflict: 'habit_id,log_date' },
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('habit_logs')
      .delete()
      .eq('habit_id', habitId)
      .eq('log_date', dateISO)
      .eq('user_id', userId);
    if (error) throw error;
  }
}
