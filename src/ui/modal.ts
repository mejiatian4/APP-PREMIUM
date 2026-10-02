import { el } from './dom';
import type { GoalTerm, AgendaRecurrence } from '../lib/types';
import { toISODate, DAY_LABELS, DAY_NAMES } from '../lib/dates';
import { createDatePicker } from './calendar';

/** Paleta de colores disponibles para los hábitos. */
export const HABIT_COLORS = [
  '#5b5bd6', // índigo (marca)
  '#0ea5e9', // cielo
  '#10b981', // esmeralda
  '#f59e0b', // ámbar
  '#ef4444', // rojo
  '#ec4899', // rosa
  '#8b5cf6', // violeta
  '#14b8a6', // teal
];

interface HabitFormResult {
  name: string;
  color: string;
}

/** Cierra el modal abierto, si lo hay. */
function dismiss(overlay: HTMLElement): void {
  overlay.classList.remove('modal--visible');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}

/**
 * Abre un formulario modal para crear o editar un hábito.
 * Resuelve con los datos, o con null si se cancela.
 */
export function openHabitForm(initial?: { name: string; color: string }): Promise<HabitFormResult | null> {
  return new Promise((resolve) => {
    const isEdit = Boolean(initial);
    let selectedColor = initial?.color ?? HABIT_COLORS[0];

    const nameInput = el('input', {
      type: 'text',
      class: 'field__input',
      id: 'habit-name',
      placeholder: 'Ej. Leer 20 minutos',
      maxLength: 60,
      value: initial?.name ?? '',
    });

    const swatches = HABIT_COLORS.map((c) => {
      const b = el('button', {
        type: 'button',
        class: 'swatch' + (c === selectedColor ? ' swatch--active' : ''),
        'aria-label': `Color ${c}`,
        title: c,
      });
      b.style.setProperty('--swatch', c);
      b.addEventListener('click', () => {
        selectedColor = c;
        swatchRow.querySelectorAll('.swatch').forEach((s) => s.classList.remove('swatch--active'));
        b.classList.add('swatch--active');
      });
      return b;
    });
    const swatchRow = el('div', { class: 'swatch-row' }, swatches);

    const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, ['Cancelar']);
    const saveBtn = el('button', { type: 'submit', class: 'btn btn--primary' }, [
      isEdit ? 'Guardar cambios' : 'Agregar hábito',
    ]);

    const form = el('form', { class: 'modal__card', role: 'dialog', 'aria-modal': 'true' }, [
      el('h2', { class: 'modal__title' }, [isEdit ? 'Editar hábito' : 'Nuevo hábito']),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'habit-name' }, ['Nombre']),
        nameInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, ['Color']),
        swatchRow,
      ]),
      el('div', { class: 'modal__actions' }, [cancelBtn, saveBtn]),
    ]);

    const overlay = el('div', { class: 'modal' }, [form]);

    const close = (result: HabitFormResult | null) => {
      dismiss(overlay);
      resolve(result);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      close({ name, color: selectedColor });
    });
    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener('keydown', function onEsc(ev) {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', onEsc);
        close(null);
      }
    });

    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal--visible'));
    nameInput.focus();
  });
}

interface GoalFormResult {
  title: string;
  description: string | null;
  term: GoalTerm;
  startDate: string | null;
  endDate: string | null;
}

const GOAL_TERMS: { value: GoalTerm; label: string }[] = [
  { value: 'short', label: 'Corto' },
  { value: 'medium', label: 'Mediano' },
  { value: 'long', label: 'Largo' },
];

/**
 * Abre un formulario modal para crear o editar una meta.
 * `presetTerm` fija el plazo inicial al crear (p. ej. al pulsar "Nueva meta"
 * dentro de la columna "Mediano plazo"). Resuelve con los datos, o con null
 * si se cancela.
 */
export function openGoalForm(
  initial?: {
    title: string;
    description: string | null;
    term: GoalTerm;
    startDate: string | null;
    endDate: string | null;
  },
  presetTerm?: GoalTerm,
): Promise<GoalFormResult | null> {
  return new Promise((resolve) => {
    const isEdit = Boolean(initial);
    let selectedTerm: GoalTerm = initial?.term ?? presetTerm ?? 'short';

    const titleInput = el('input', {
      type: 'text',
      class: 'field__input',
      id: 'goal-title',
      placeholder: 'Ej. Correr una maratón',
      maxLength: 80,
      value: initial?.title ?? '',
      required: true,
    });

    const descInput = el('textarea', {
      class: 'field__input field__input--area',
      id: 'goal-desc',
      placeholder: 'Detalles opcionales…',
      maxLength: 300,
      rows: 3,
      value: initial?.description ?? '',
    });

    // Calendarios de un clic: nada de escribir fechas a mano. El inicio no
    // puede ser un día pasado, y el fin nunca puede ser anterior al inicio
    // elegido (su calendario deshabilita esos días en cuanto el inicio cambia).
    const todayISO = toISODate(new Date());
    const endPicker = createDatePicker({
      initial: initial?.endDate ?? null,
      min: initial?.startDate ?? todayISO,
    });
    const startPicker = createDatePicker({
      initial: initial?.startDate ?? null,
      min: todayISO,
      onChange: (iso) => endPicker.setMin(iso ?? todayISO),
    });
    const dateError = el('p', { class: 'field__error' }, []);

    const termButtons = GOAL_TERMS.map(({ value, label }) => {
      const b = el(
        'button',
        {
          type: 'button',
          class: 'term-btn' + (value === selectedTerm ? ' term-btn--active' : ''),
        },
        [label],
      );
      b.addEventListener('click', () => {
        selectedTerm = value;
        termRow.querySelectorAll('.term-btn').forEach((btn) => btn.classList.remove('term-btn--active'));
        b.classList.add('term-btn--active');
      });
      return b;
    });
    const termRow = el('div', { class: 'term-toggle' }, termButtons);

    const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, ['Cancelar']);
    const saveBtn = el('button', { type: 'submit', class: 'btn btn--primary' }, [
      isEdit ? 'Guardar cambios' : 'Agregar meta',
    ]);

    const form = el('form', { class: 'modal__card modal__card--wide', role: 'dialog', 'aria-modal': 'true' }, [
      el('h2', { class: 'modal__title' }, [isEdit ? 'Editar meta' : 'Nueva meta']),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'goal-title' }, ['Título']),
        titleInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'goal-desc' }, ['Descripción (opcional)']),
        descInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, ['Plazo']),
        termRow,
      ]),
      el('div', { class: 'cal-pair' }, [
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label' }, ['Inicio']),
          startPicker.element,
        ]),
        el('div', { class: 'field' }, [
          el('label', { class: 'field__label' }, ['Fin']),
          endPicker.element,
        ]),
      ]),
      dateError,
      el('div', { class: 'modal__actions' }, [cancelBtn, saveBtn]),
    ]);

    const overlay = el('div', { class: 'modal' }, [form]);

    const close = (result: GoalFormResult | null) => {
      dismiss(overlay);
      resolve(result);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        return;
      }
      const startDate = startPicker.getValue();
      const endDate = endPicker.getValue();
      if (!startDate) {
        dateError.textContent = 'Elige una fecha de inicio en el calendario.';
        return;
      }
      if (!endDate) {
        dateError.textContent = 'Elige una fecha de fin en el calendario.';
        return;
      }
      close({
        title,
        description: descInput.value.trim() || null,
        term: selectedTerm,
        startDate,
        endDate,
      });
    });
    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener('keydown', function onEsc(ev) {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', onEsc);
        close(null);
      }
    });

    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal--visible'));
    titleInput.focus();
  });
}

interface AgendaItemFormResult {
  title: string;
  note: string | null;
  timeOfDay: string; // 'HH:MM'
  recurrence: AgendaRecurrence;
  weekdays: number[]; // 0=lunes..6=domingo; solo si recurrence === 'weekly'
  startDate: string;
  endDate: string | null;
  color: string;
}

const AGENDA_RECURRENCES: { value: AgendaRecurrence; label: string }[] = [
  { value: 'once', label: 'Una vez' },
  { value: 'daily', label: 'Todos los días' },
  { value: 'weekly', label: 'Días específicos' },
];

/**
 * Abre un formulario modal para crear o editar un ítem de agenda.
 * `presetDate` fija la fecha inicial al crear desde la vista de un día
 * concreto. Resuelve con los datos, o con null si se cancela.
 */
export function openAgendaItemForm(
  initial?: {
    title: string;
    note: string | null;
    timeOfDay: string;
    recurrence: AgendaRecurrence;
    weekdays: number[];
    startDate: string;
    endDate: string | null;
    color: string;
  },
  presetDate?: string,
): Promise<AgendaItemFormResult | null> {
  return new Promise((resolve) => {
    const isEdit = Boolean(initial);
    let selectedRecurrence: AgendaRecurrence = initial?.recurrence ?? 'once';
    let selectedWeekdays = new Set<number>(initial?.weekdays ?? []);
    let selectedColor = initial?.color ?? HABIT_COLORS[0];

    const titleInput = el('input', {
      type: 'text',
      class: 'field__input',
      id: 'agenda-title',
      placeholder: 'Ej. Llamar al proveedor',
      maxLength: 80,
      value: initial?.title ?? '',
      required: true,
    });

    const noteInput = el('textarea', {
      class: 'field__input field__input--area',
      id: 'agenda-note',
      placeholder: 'Detalles opcionales…',
      maxLength: 200,
      rows: 2,
      value: initial?.note ?? '',
    });

    const timeInput = el('input', {
      type: 'time',
      class: 'field__input',
      id: 'agenda-time',
      value: initial?.timeOfDay.slice(0, 5) ?? '',
      required: true,
    }) as HTMLInputElement;

    // Mismo calendario de un clic que usan las metas. El inicio no puede ser
    // un día pasado (salvo que ya lo fuera al editar), y el fin nunca puede
    // ser anterior al inicio elegido.
    const todayISO = toISODate(new Date());
    const endPicker = createDatePicker({
      initial: initial?.endDate ?? null,
      min: initial?.startDate ?? presetDate ?? todayISO,
    });
    const startPicker = createDatePicker({
      initial: initial?.startDate ?? presetDate ?? null,
      min: initial?.startDate ?? todayISO,
      onChange: (iso) => endPicker.setMin(iso ?? todayISO),
    });
    const dateError = el('p', { class: 'field__error' }, []);

    const startField = el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, ['Fecha']),
      startPicker.element,
    ]);
    const endField = el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, ['Hasta (opcional)']),
      endPicker.element,
    ]);
    const datesRow = el('div', { class: 'cal-pair' }, [startField, endField]);

    const weekdayButtons = DAY_LABELS.map((label, i) => {
      const b = el(
        'button',
        {
          type: 'button',
          class: 'weekday-btn' + (selectedWeekdays.has(i) ? ' weekday-btn--active' : ''),
          'aria-pressed': String(selectedWeekdays.has(i)),
          'aria-label': DAY_NAMES[i],
          title: DAY_NAMES[i],
        },
        [label],
      );
      b.addEventListener('click', () => {
        if (selectedWeekdays.has(i)) selectedWeekdays.delete(i);
        else selectedWeekdays.add(i);
        b.classList.toggle('weekday-btn--active', selectedWeekdays.has(i));
        b.setAttribute('aria-pressed', String(selectedWeekdays.has(i)));
      });
      return b;
    });
    const weekdayRow = el('div', { class: 'weekday-toggle' }, weekdayButtons);
    const weekdayField = el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, ['¿Qué días?']),
      weekdayRow,
    ]);

    function syncRecurrenceUI(): void {
      weekdayField.style.display = selectedRecurrence === 'weekly' ? '' : 'none';
      endField.style.display = selectedRecurrence === 'once' ? 'none' : '';
      startField.querySelector('.field__label')!.textContent =
        selectedRecurrence === 'once' ? 'Fecha' : 'Desde';
    }

    const recurrenceButtons = AGENDA_RECURRENCES.map(({ value, label }) => {
      const b = el(
        'button',
        {
          type: 'button',
          class: 'term-btn' + (value === selectedRecurrence ? ' term-btn--active' : ''),
        },
        [label],
      );
      b.addEventListener('click', () => {
        selectedRecurrence = value;
        recurrenceRow.querySelectorAll('.term-btn').forEach((btn) => btn.classList.remove('term-btn--active'));
        b.classList.add('term-btn--active');
        syncRecurrenceUI();
      });
      return b;
    });
    const recurrenceRow = el('div', { class: 'term-toggle' }, recurrenceButtons);
    syncRecurrenceUI();

    const swatches = HABIT_COLORS.map((c) => {
      const b = el('button', {
        type: 'button',
        class: 'swatch' + (c === selectedColor ? ' swatch--active' : ''),
        'aria-label': `Color ${c}`,
        title: c,
      });
      b.style.setProperty('--swatch', c);
      b.addEventListener('click', () => {
        selectedColor = c;
        swatchRow.querySelectorAll('.swatch').forEach((s) => s.classList.remove('swatch--active'));
        b.classList.add('swatch--active');
      });
      return b;
    });
    const swatchRow = el('div', { class: 'swatch-row' }, swatches);

    const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, ['Cancelar']);
    const saveBtn = el('button', { type: 'submit', class: 'btn btn--primary' }, [
      isEdit ? 'Guardar cambios' : 'Agendar',
    ]);

    const form = el('form', { class: 'modal__card modal__card--wide', role: 'dialog', 'aria-modal': 'true' }, [
      el('h2', { class: 'modal__title' }, [isEdit ? 'Editar pendiente' : 'Nuevo pendiente']),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'agenda-title' }, ['Título']),
        titleInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'agenda-note' }, ['Nota (opcional)']),
        noteInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label', for: 'agenda-time' }, ['Hora']),
        timeInput,
      ]),
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, ['Repetición']),
        recurrenceRow,
      ]),
      weekdayField,
      datesRow,
      dateError,
      el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, ['Color']),
        swatchRow,
      ]),
      el('div', { class: 'modal__actions' }, [cancelBtn, saveBtn]),
    ]);

    const overlay = el('div', { class: 'modal' }, [form]);

    const close = (result: AgendaItemFormResult | null) => {
      dismiss(overlay);
      resolve(result);
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = titleInput.value.trim();
      if (!title) {
        titleInput.focus();
        return;
      }
      if (!timeInput.value) {
        timeInput.focus();
        return;
      }
      const startDate = startPicker.getValue();
      if (!startDate) {
        dateError.textContent =
          selectedRecurrence === 'once' ? 'Elige una fecha en el calendario.' : 'Elige desde cuándo empieza.';
        return;
      }
      if (selectedRecurrence === 'weekly' && selectedWeekdays.size === 0) {
        dateError.textContent = 'Elige al menos un día de la semana.';
        return;
      }
      close({
        title,
        note: noteInput.value.trim() || null,
        timeOfDay: timeInput.value,
        recurrence: selectedRecurrence,
        weekdays: selectedRecurrence === 'weekly' ? [...selectedWeekdays] : [],
        startDate,
        endDate: selectedRecurrence === 'once' ? null : endPicker.getValue(),
        color: selectedColor,
      });
    });
    cancelBtn.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    document.addEventListener('keydown', function onEsc(ev) {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', onEsc);
        close(null);
      }
    });

    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal--visible'));
    titleInput.focus();
  });
}

/** Diálogo de confirmación. Resuelve true si el usuario confirma. */
export function confirmDialog(message: string, confirmLabel = 'Eliminar'): Promise<boolean> {
  return new Promise((resolve) => {
    const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, ['Cancelar']);
    const okBtn = el('button', { type: 'button', class: 'btn btn--danger' }, [confirmLabel]);

    const card = el('div', { class: 'modal__card', role: 'alertdialog', 'aria-modal': 'true' }, [
      el('p', { class: 'modal__message' }, [message]),
      el('div', { class: 'modal__actions' }, [cancelBtn, okBtn]),
    ]);
    const overlay = el('div', { class: 'modal' }, [card]);

    const close = (result: boolean) => {
      dismiss(overlay);
      resolve(result);
    };
    cancelBtn.addEventListener('click', () => close(false));
    okBtn.addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal--visible'));
    okBtn.focus();
  });
}
