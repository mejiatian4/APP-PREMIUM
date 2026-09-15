// ============================================================
//  Edge Function: ai-coach
//  Chat con el coach de hábitos de KROTON HABITOS, usando la API
//  gratuita de Groq (no pide tarjeta, a diferencia del free tier
//  de Gemini que en algunas cuentas/regiones exige billing).
// ============================================================
//
// Cómo desplegarla (una sola vez, con la Supabase CLI):
//   1. supabase login
//   2. supabase link --project-ref <tu-project-ref>
//   3. Crea una API key gratis en https://console.groq.com/keys
//   4. supabase secrets set GROQ_API_KEY=tu_api_key
//   5. supabase functions deploy ai-coach
//
// La función exige un usuario autenticado (verifica el JWT que llega en el
// header Authorization) para que nadie pueda usarla sin haber iniciado
// sesión en la app. Antes de llamar al modelo, consulta los hábitos, registros
// y metas del propio usuario (con su mismo token, así que RLS aplica igual
// que en el cliente: jamás puede ver datos de otra persona) y arma un resumen
// que se le da al modelo como contexto, para que responda con datos reales.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// API compatible con el formato de OpenAI. Groq retiró `llama-3.3-70b-versatile`
// el 16 de agosto de 2026; usamos el reemplazo que ellos mismos recomendaron
// (ver https://console.groq.com/docs/deprecations).
const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  'Eres el Coach de KROTON HABITOS, un asistente que ayuda a las personas a ser constantes con sus ' +
  'hábitos y sus metas. Respondes siempre en español, con un tono cercano, directo y motivador, ' +
  'inspirado en la filosofía estoica (disciplina, enfocarse en lo que depende de uno, constancia ' +
  'diaria) pero sin sonar acartonado ni repetitivo. Das consejos prácticos y concretos, nunca genéricos ' +
  'ni de relleno. Mantén las respuestas breves (3 a 5 líneas) salvo que te pidan más detalle. Antes de ' +
  'cada mensaje del usuario recibes un bloque "CONTEXTO REAL DEL USUARIO" con sus hábitos, rachas y ' +
  'metas actuales: básate en esos datos para responder y para dar consejos concretos sobre ESAS metas o ' +
  'hábitos en particular. Nunca inventes números, fechas o metas que no estén en ese contexto. Si algo ' +
  'que te preguntan no aparece ahí, dilo con naturalidad en vez de inventarlo.';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_TURNS = 10;
const LOOKBACK_DAYS = 60;

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

interface HabitRow {
  id: string;
  name: string;
  created_at: string;
}

interface LogRow {
  habit_id: string;
  log_date: string;
  completed: boolean;
}

interface GoalRow {
  title: string;
  description: string | null;
  term: 'short' | 'medium' | 'long';
  start_date: string | null;
  end_date: string | null;
  completed: boolean;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ---- Fechas: trabajamos siempre con strings 'YYYY-MM-DD' y aritmética en
// UTC, para que el resultado no dependa de la zona horaria del servidor. ----

function isValidISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDaysISO(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetweenISO(aISO: string, bISO: string): number {
  const ms = new Date(`${bISO}T00:00:00Z`).getTime() - new Date(`${aISO}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

const TERM_LABEL: Record<GoalRow['term'], string> = {
  short: 'Corto plazo',
  medium: 'Mediano plazo',
  long: 'Largo plazo',
};

function formatGoals(goals: GoalRow[]): string {
  if (goals.length === 0) return 'Todavía no tiene ninguna meta creada.';

  const byTerm: Record<GoalRow['term'], GoalRow[]> = { short: [], medium: [], long: [] };
  for (const g of goals) byTerm[g.term]?.push(g);

  const parts: string[] = [];
  for (const term of ['short', 'medium', 'long'] as const) {
    const list = byTerm[term];
    if (list.length === 0) continue;
    const lines = list.map((g) => {
      const status = g.completed ? 'cumplida' : 'pendiente';
      const range = g.start_date && g.end_date ? ` (del ${g.start_date} al ${g.end_date})` : '';
      const desc = g.description ? ` — ${g.description}` : '';
      return `  · "${g.title}"${range}, ${status}${desc}`;
    });
    parts.push(`${TERM_LABEL[term]}:\n${lines.join('\n')}`);
  }
  return parts.join('\n');
}

/**
 * Trae hábitos, registros recientes y metas del usuario (con su propio
 * token, respetando RLS) y arma un resumen en texto plano para dárselo al
 * modelo como contexto. Si algo falla, devuelve un contexto de aviso en vez
 * de tumbar la conversación entera.
 */
async function buildUserContext(supabaseClient: SupabaseClient, todayISO: string): Promise<string> {
  const windowStartISO = addDaysISO(todayISO, -(LOOKBACK_DAYS - 1));
  const last30StartISO = addDaysISO(todayISO, -29);

  const [habitsRes, logsRes, goalsRes] = await Promise.all([
    supabaseClient.from('habits').select('id, name, created_at').order('position', { ascending: true }),
    supabaseClient
      .from('habit_logs')
      .select('habit_id, log_date, completed')
      .gte('log_date', windowStartISO)
      .lte('log_date', todayISO),
    supabaseClient
      .from('goals')
      .select('title, description, term, start_date, end_date, completed')
      .order('created_at', { ascending: true }),
  ]);

  if (habitsRes.error || logsRes.error || goalsRes.error) {
    console.error('Context fetch error:', habitsRes.error, logsRes.error, goalsRes.error);
    return 'No se pudo cargar el contexto del usuario en este momento (falla temporal). Dile que lo intente de nuevo si necesitas sus datos reales.';
  }

  const habits = (habitsRes.data ?? []) as HabitRow[];
  const logs = (logsRes.data ?? []) as LogRow[];
  const goals = (goalsRes.data ?? []) as GoalRow[];

  // Días con al menos un hábito cumplido (para racha y % del mes).
  const activeDays = new Set<string>();
  const perHabitDone = new Map<string, number>();
  for (const log of logs) {
    if (!log.completed) continue;
    activeDays.add(log.log_date);
    if (log.log_date >= last30StartISO) {
      perHabitDone.set(log.habit_id, (perHabitDone.get(log.habit_id) ?? 0) + 1);
    }
  }

  // Racha actual.
  let streak = 0;
  let cursor = activeDays.has(todayISO) ? todayISO : addDaysISO(todayISO, -1);
  while (activeDays.has(cursor)) {
    streak++;
    cursor = addDaysISO(cursor, -1);
  }

  // Mejor racha dentro de la ventana consultada.
  let best = 0;
  let run = 0;
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const d = addDaysISO(windowStartISO, i);
    if (activeDays.has(d)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  best = Math.max(best, streak);

  // % de días del mes (hasta hoy) con al menos un hábito cumplido.
  const monthStartISO = `${todayISO.slice(0, 7)}-01`;
  const dayOfMonth = Number(todayISO.slice(8, 10));
  let monthActiveDays = 0;
  for (const d of activeDays) if (d >= monthStartISO && d <= todayISO) monthActiveDays++;
  const monthPct = dayOfMonth > 0 ? Math.round((monthActiveDays / dayOfMonth) * 100) : 0;

  // % de cumplimiento por hábito en los últimos 30 días.
  const habitLines = habits.map((h) => {
    const createdISO = h.created_at.slice(0, 10);
    const effectiveStartISO = createdISO > last30StartISO ? createdISO : last30StartISO;
    const daysConsidered = Math.max(1, daysBetweenISO(effectiveStartISO, todayISO) + 1);
    const done = perHabitDone.get(h.id) ?? 0;
    const pct = Math.min(100, Math.round((done / daysConsidered) * 100));
    return `  · ${h.name}: ${pct}%`;
  });

  return (
    `CONTEXTO REAL DEL USUARIO (hoy es ${todayISO}; no lo inventes de otra forma, esto es lo único ` +
    `fiable que tienes de él):\n\n` +
    `Racha y constancia:\n` +
    `  · Racha actual: ${streak} día(s) consecutivos.\n` +
    `  · Mejor racha reciente: ${best}${best >= LOOKBACK_DAYS ? '+' : ''} día(s) (últimos ${LOOKBACK_DAYS} días).\n` +
    `  · Cumplimiento de este mes: ${monthPct}%.\n\n` +
    `Hábitos (% de cumplimiento, últimos 30 días):\n` +
    `${habits.length ? habitLines.join('\n') : '  · Todavía no tiene hábitos creados.'}\n\n` +
    `Metas:\n${formatGoals(goals)}`
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) return json({ error: 'Falta configurar GROQ_API_KEY en los secrets de Supabase.' }, 500);

  // Solo usuarios autenticados de la app pueden usar el coach.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!supabaseUrl || !anonKey) return json({ error: 'Función mal configurada.' }, 500);

  const supabaseClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'No autenticado.' }, 401);

  let body: { message?: unknown; history?: unknown; todayISO?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo de la petición inválido.' }, 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json({ error: 'Mensaje vacío.' }, 400);
  if (message.length > MAX_MESSAGE_LENGTH) return json({ error: 'El mensaje es demasiado largo.' }, 400);

  const todayISO = isValidISODate(body.todayISO) ? body.todayISO : new Date().toISOString().slice(0, 10);

  const rawHistory = Array.isArray(body.history) ? (body.history as ChatTurn[]) : [];
  const history = rawHistory
    .filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && typeof turn.text === 'string')
    .slice(-MAX_HISTORY_TURNS);

  const userContext = await buildUserContext(supabaseClient, todayISO);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: userContext },
    ...history.map((turn) => ({ role: turn.role, content: turn.text })),
    { role: 'user', content: message },
  ];

  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 400,
        temperature: 0.7,
      }),
    });
  } catch (err) {
    console.error('Groq fetch failed:', err);
    return json({ error: 'El asistente no está disponible en este momento.' }, 502);
  }

  if (!groqRes.ok) {
    console.error('Groq error:', groqRes.status, await groqRes.text());
    return json({ error: 'El asistente no está disponible en este momento.' }, 502);
  }

  const data = await groqRes.json();
  const reply: string | undefined = data?.choices?.[0]?.message?.content;
  if (!reply) return json({ error: 'El asistente no pudo generar una respuesta. Intenta de nuevo.' }, 502);

  return json({ reply });
});
