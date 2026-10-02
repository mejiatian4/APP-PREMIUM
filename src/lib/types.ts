// Tipos de dominio compartidos por toda la aplicación.

/** Un hábito tal como se guarda en la base de datos. */
export interface Habit {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
}

/** Un registro de cumplimiento de un hábito en una fecha concreta. */
export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string; // formato ISO 'YYYY-MM-DD'
  completed: boolean;
  created_at: string;
}

/** Mapa de cumplimientos en memoria: clave `${habit_id}|${YYYY-MM-DD}` -> completado. */
export type CompletionMap = Map<string, boolean>;

/** Plazo de una meta. */
export type GoalTerm = 'short' | 'medium' | 'long';

/** Una meta (corto, mediano o largo plazo) tal como se guarda en la base de datos. */
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  term: GoalTerm;
  start_date: string | null; // formato ISO 'YYYY-MM-DD'
  end_date: string | null; // formato ISO 'YYYY-MM-DD'
  completed: boolean;
  created_at: string;
}

/** Un mensaje en la conversación con el coach de IA. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** Cómo se repite un ítem de la agenda. */
export type AgendaRecurrence = 'once' | 'daily' | 'weekly';

/** Un ítem de agenda (la "plantilla"): título + hora + regla de repetición. */
export interface AgendaItem {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  time_of_day: string; // 'HH:MM:SS' tal como lo devuelve Postgres
  recurrence: AgendaRecurrence;
  weekdays: number[]; // 0=lunes..6=domingo; solo relevante si recurrence === 'weekly'
  start_date: string; // 'YYYY-MM-DD'; para 'once' es también la única fecha de ocurrencia
  end_date: string | null;
  color: string;
  created_at: string;
}

/** Cumplimiento de un ítem de agenda en una fecha concreta. */
export interface AgendaLog {
  id: string;
  agenda_item_id: string;
  user_id: string;
  occurrence_date: string; // 'YYYY-MM-DD'
  completed: boolean;
  created_at: string;
}
