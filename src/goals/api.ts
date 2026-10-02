import { supabase } from '../lib/supabase';
import type { Goal, GoalTerm } from '../lib/types';

/** Lista las metas del usuario: pendientes primero, ordenadas por fecha de inicio. */
export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('completed', { ascending: true })
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface GoalFields {
  title: string;
  description: string | null;
  term: GoalTerm;
  start_date: string | null;
  end_date: string | null;
}

/** Crea una meta nueva. */
export async function createGoal(userId: string, fields: GoalFields): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({ user_id: userId, ...fields })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza campos de una meta (título, descripción, plazo, fecha o estado).
 * El filtro por `userId` (además de `id`) es puro cinturón y tirantes: RLS ya
 * impide tocar metas ajenas, esto solo evita depender de una sola capa.
 */
export async function updateGoal(
  id: string,
  userId: string,
  fields: Partial<GoalFields & { completed: boolean }>,
): Promise<void> {
  const { error } = await supabase.from('goals').update(fields).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Elimina una meta. */
export async function deleteGoal(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
