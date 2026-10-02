import type { Goal, GoalTerm } from '../lib/types';
import { toISODate, formatShortDate } from '../lib/dates';
import { listGoals, createGoal, updateGoal, deleteGoal } from './api';
import { renderGantt } from './gantt';
import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { toast, errorMessage } from '../ui/toast';
import { openGoalForm, confirmDialog } from '../ui/modal';

const TERMS: GoalTerm[] = ['short', 'medium', 'long'];
const TERM_LABELS: Record<GoalTerm, string> = {
  short: 'Corto plazo',
  medium: 'Mediano plazo',
  long: 'Largo plazo',
};

/** Rango legible para la tarjeta: "1 jul – 15 ago 2026", o solo el extremo si falta uno. */
function formatGoalRange(startISO: string | null, endISO: string | null): string {
  if (startISO && endISO) return `${formatShortDate(startISO)} – ${formatShortDate(endISO)}`;
  if (endISO) return `Fin: ${formatShortDate(endISO)}`;
  return `Inicio: ${formatShortDate(startISO!)}`;
}

export async function renderGoalsBoard(root: HTMLElement, userId: string): Promise<void> {
  clear(root);

  let goals: Goal[] = [];
  const columns = new Map<GoalTerm, HTMLElement>();

  const ganttBody = el('div', { class: 'gantt-wrap' });
  const ganttCard = el('section', { class: 'card card--gantt' }, [
    el('div', { class: 'card__head' }, [el('h2', { class: 'card__title' }, ['Cronograma'])]),
    ganttBody,
  ]);

  const board = el(
    'div',
    { class: 'goals-board' },
    TERMS.map((term) => {
      const list = el('div', { class: 'goal-list' });
      columns.set(term, list);

      const addBtn = el('button', { class: 'btn btn--soft btn--block', type: 'button' }, [
        icons.plus(),
        el('span', {}, ['Nueva meta']),
      ]);
      addBtn.addEventListener('click', () => void onAddGoal(term));

      return el('section', { class: 'goal-column' }, [
        el('div', { class: 'goal-column__head' }, [
          el('h2', { class: 'goal-column__title' }, [TERM_LABELS[term]]),
        ]),
        list,
        addBtn,
      ]);
    }),
  );

  root.append(ganttCard, board);
  await loadGoals();

  async function loadGoals(): Promise<void> {
    for (const term of TERMS) {
      clear(columns.get(term)!);
      columns.get(term)!.append(el('div', { class: 'spinner spinner--sm', 'aria-hidden': 'true' }));
    }
    try {
      goals = await listGoals();
      renderAll();
    } catch (err) {
      toast(errorMessage(err, 'No se pudieron cargar tus metas.'), 'error');
      for (const term of TERMS) {
        clear(columns.get(term)!);
        columns.get(term)!.append(el('p', { class: 'state__text' }, ['No se pudo cargar.']));
      }
    }
  }

  function renderAll(): void {
    renderColumns();
    renderGantt(ganttBody, goals);
  }

  function renderColumns(): void {
    for (const term of TERMS) {
      const list = columns.get(term)!;
      clear(list);
      const termGoals = goals.filter((g) => g.term === term);
      if (termGoals.length === 0) {
        list.append(el('p', { class: 'goal-empty' }, ['Sin metas todavía.']));
        continue;
      }
      for (const goal of termGoals) list.append(renderGoalCard(goal));
    }
  }

  function renderGoalCard(goal: Goal): HTMLElement {
    const toggleBtn = el(
      'button',
      {
        class: 'goal-check' + (goal.completed ? ' goal-check--on' : ''),
        type: 'button',
        'aria-label': goal.completed ? 'Marcar como pendiente' : 'Marcar como cumplida',
      },
      [icons.check()],
    );
    toggleBtn.addEventListener('click', () => void onToggleGoal(goal));

    const editBtn = el(
      'button',
      { class: 'iconbtn', type: 'button', 'aria-label': `Editar ${goal.title}` },
      [icons.pencil()],
    );
    editBtn.addEventListener('click', () => void onEditGoal(goal));

    const delBtn = el(
      'button',
      { class: 'iconbtn iconbtn--danger', type: 'button', 'aria-label': `Eliminar ${goal.title}` },
      [icons.trash()],
    );
    delBtn.addEventListener('click', () => void onDeleteGoal(goal));

    const bodyChildren: (Node | string)[] = [el('span', { class: 'goal-card__title' }, [goal.title])];
    if (goal.description) {
      bodyChildren.push(el('p', { class: 'goal-card__desc' }, [goal.description]));
    }
    if (goal.start_date || goal.end_date) {
      const overdue = !goal.completed && Boolean(goal.end_date) && goal.end_date! < toISODate(new Date());
      bodyChildren.push(
        el('span', { class: 'goal-card__date' + (overdue ? ' goal-card__date--overdue' : '') }, [
          `${overdue ? 'Vencida · ' : ''}${formatGoalRange(goal.start_date, goal.end_date)}`,
        ]),
      );
    }

    return el('div', { class: 'goal-card' + (goal.completed ? ' goal-card--done' : '') }, [
      toggleBtn,
      el('div', { class: 'goal-card__body' }, bodyChildren),
      el('div', { class: 'goal-card__actions' }, [editBtn, delBtn]),
    ]);
  }

  async function onAddGoal(term: GoalTerm): Promise<void> {
    const result = await openGoalForm(undefined, term);
    if (!result) return;
    try {
      const created = await createGoal(userId, {
        title: result.title,
        description: result.description,
        term: result.term,
        start_date: result.startDate,
        end_date: result.endDate,
      });
      goals.push(created);
      renderAll();
      toast('Meta agregada.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo crear la meta.'), 'error');
    }
  }

  async function onEditGoal(goal: Goal): Promise<void> {
    const result = await openGoalForm({
      title: goal.title,
      description: goal.description,
      term: goal.term,
      startDate: goal.start_date,
      endDate: goal.end_date,
    });
    if (!result) return;
    try {
      await updateGoal(goal.id, userId, {
        title: result.title,
        description: result.description,
        term: result.term,
        start_date: result.startDate,
        end_date: result.endDate,
      });
      goal.title = result.title;
      goal.description = result.description;
      goal.term = result.term;
      goal.start_date = result.startDate;
      goal.end_date = result.endDate;
      renderAll();
      toast('Meta actualizada.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo actualizar la meta.'), 'error');
    }
  }

  async function onToggleGoal(goal: Goal): Promise<void> {
    const next = !goal.completed;
    goal.completed = next;
    renderAll();
    try {
      await updateGoal(goal.id, userId, { completed: next });
    } catch (err) {
      goal.completed = !next;
      renderAll();
      toast(errorMessage(err, 'No se pudo actualizar la meta.'), 'error');
    }
  }

  async function onDeleteGoal(goal: Goal): Promise<void> {
    const ok = await confirmDialog(`¿Eliminar la meta "${goal.title}"?`);
    if (!ok) return;
    try {
      await deleteGoal(goal.id, userId);
      goals = goals.filter((g) => g.id !== goal.id);
      renderAll();
      toast('Meta eliminada.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo eliminar.'), 'error');
    }
  }
}
