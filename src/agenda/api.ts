import { supabase } from '../lib/supabase';
import type { AgendaItem, AgendaLog, AgendaRecurrence } from '../lib/types';

// ---------------------------------------------------------------------------
//  Ítems de agenda (CRUD)
// ---------------------------------------------------------------------------

/** Lista todos los ítems de agenda del usuario. */
export async function listAgendaItems(): Promise<AgendaItem[]> {
  const { data, error } = await supabase
    .from('agenda_items')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export interface AgendaItemFields {
  title: string;
  note: string | null;
  time_of_day: string; // 'HH:MM'
  recurrence: AgendaRecurrence;
  weekdays: number[]; // [] salvo recurrence === 'weekly'
  start_date: string;
  end_date: string | null;
  color: string;
}

/** Crea un ítem de agenda nuevo. */
export async function createAgendaItem(userId: string, fields: AgendaItemFields): Promise<AgendaItem> {
  const { data, error } = await supabase
    .from('agenda_items')
    .insert({ user_id: userId, ...fields })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza campos de un ítem de agenda.
 * El filtro por `userId` (además de `id`) es puro cinturón y tirantes: RLS ya
 * impide tocar ítems ajenos, esto solo evita depender de una sola capa.
 */
export async function updateAgendaItem(
  id: string,
  userId: string,
  fields: Partial<AgendaItemFields>,
): Promise<void> {
  const { error } = await supabase.from('agenda_items').update(fields).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Elimina un ítem de agenda. Sus registros se borran en cascada (ver schema.sql). */
export async function deleteAgendaItem(id: string, userId: string): Promise<void> {
  const { error } = await supabase.from('agenda_items').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
//  Registros de cumplimiento por ocurrencia
// ---------------------------------------------------------------------------

/** Trae los registros del usuario entre dos fechas (inclusive), formato 'YYYY-MM-DD'. */
export async function getAgendaLogsForRange(startISO: string, endISO: string): Promise<AgendaLog[]> {
  const { data, error } = await supabase
    .from('agenda_logs')
    .select('*')
    .gte('occurrence_date', startISO)
    .lte('occurrence_date', endISO);

  if (error) throw error;
  return data ?? [];
}

/**
 * Marca o desmarca la ocurrencia de un ítem en una fecha concreta.
 * - Marcar    -> upsert de la fila (completed = true).
 * - Desmarcar -> borra la fila (ausencia = no realizado), igual que habit_logs.
 */
export async function setAgendaCompletion(
  userId: string,
  agendaItemId: string,
  occurrenceDateISO: string,
  completed: boolean,
): Promise<void> {
  if (completed) {
    const { error } = await supabase
      .from('agenda_logs')
      .upsert(
        { user_id: userId, agenda_item_id: agendaItemId, occurrence_date: occurrenceDateISO, completed: true },
        { onConflict: 'agenda_item_id,occurrence_date' },
      );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('agenda_logs')
      .delete()
      .eq('agenda_item_id', agendaItemId)
      .eq('occurrence_date', occurrenceDateISO)
      .eq('user_id', userId);
    if (error) throw error;
  }
}
