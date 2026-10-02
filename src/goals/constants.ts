import type { GoalTerm } from '../lib/types';

/** Los tres plazos de una meta, en el orden en que siempre se muestran. */
export const TERMS: GoalTerm[] = ['short', 'medium', 'long'];

/** Etiqueta legible de cada plazo. */
export const TERM_LABELS: Record<GoalTerm, string> = {
  short: 'Corto plazo',
  medium: 'Mediano plazo',
  long: 'Largo plazo',
};
