import type { AgendaItem, CompletionMap } from '../lib/types';
import { toISODate, addDays } from '../lib/dates';
import {
  listAgendaItems,
  createAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
  getAgendaLogsForRange,
  setAgendaCompletion,
} from './api';
import { occurrencesForDate, describeRecurrence } from './occurrences';
import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { toast, errorMessage } from '../ui/toast';
import { openAgendaItemForm, confirmDialog } from '../ui/modal';

const key = (agendaItemId: string, dateISO: string) => `${agendaItemId}|${dateISO}`;

/** 'HH:MM:SS' o 'HH:MM' -> "3:00 p.m.". */
function formatTime(value: string): string {
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}

/** "Hoy · lun 21 sep" si es hoy, o "lun 21 sep" para cualquier otro día. */
function formatDayLabel(date: Date): string {
  const base = date
    .toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace('.', '');
  const label = base.charAt(0).toUpperCase() + base.slice(1);
  return toISODate(date) === toISODate(new Date()) ? `Hoy · ${label}` : label;
}

/**
 * Pinta la pestaña "Agenda": el día seleccionado (con check-off) y, aparte,
 * "Mis pendientes" con todos los ítems configurados sin importar el día en
 * que caigan — es la forma de editar/eliminar, por ejemplo, uno que solo
 * ocurre los miércoles mientras se está viendo otro día. A diferencia de
 * Hábitos (grid semanal, mide racha), aquí no hay streaks ni heatmap — solo
 * "¿se hizo o no esta ocurrencia concreta?".
 */
export async function renderAgendaView(root: HTMLElement, userId: string): Promise<void> {
  clear(root);

  let items: AgendaItem[] = [];
  let completion: CompletionMap = new Map();
  let currentDate = new Date();

  // ---- Tarjeta: el día ----
  const dayLabel = el('span', { class: 'weeknav__range' }, ['—']);
  const prevBtn = el('button', { class: 'btn btn--icon', 'aria-label': 'Día anterior' }, [icons.chevronLeft()]);
  const nextBtn = el('button', { class: 'btn btn--icon', 'aria-label': 'Día siguiente' }, [icons.chevronRight()]);
  const todayBtn = el('button', { class: 'btn btn--soft' }, ['Hoy']);
  const addBtn = el('button', { class: 'btn btn--primary btn--icon-text' }, [
    icons.plus(),
    el('span', {}, ['Agendar']),
  ]);

  prevBtn.addEventListener('click', () => {
    currentDate = addDays(currentDate, -1);
    void loadDay();
  });
  nextBtn.addEventListener('click', () => {
    currentDate = addDays(currentDate, 1);
    void loadDay();
  });
  todayBtn.addEventListener('click', () => {
    currentDate = new Date();
    void loadDay();
  });
  addBtn.addEventListener('click', () => void onAdd());

  const dayNav = el('div', { class: 'weeknav' }, [
    el('div', { class: 'weeknav__left' }, [prevBtn, dayLabel, nextBtn, todayBtn]),
    addBtn,
  ]);

  const dayList = el('div', { class: 'goal-list' });
  const dayCard = el('section', { class: 'card card--agenda' }, [
    el('div', { class: 'card__head' }, [el('h2', { class: 'card__title' }, ['Agenda'])]),
    dayNav,
    dayList,
  ]);

  // ---- Tarjeta: Mis pendientes (gestión, sin filtrar por día) ----
  const manageList = el('div', { class: 'goal-list' });
  const manageCard = el('section', { class: 'card card--agenda' }, [
    el('div', { class: 'card__head' }, [el('h2', { class: 'card__title' }, ['Mis pendientes'])]),
    manageList,
  ]);

  root.append(dayCard, manageCard);
  await init();

  async function init(): Promise<void> {
    clear(dayList);
    clear(manageList);
    dayList.append(el('div', { class: 'spinner spinner--sm', 'aria-hidden': 'true' }));
    manageList.append(el('div', { class: 'spinner spinner--sm', 'aria-hidden': 'true' }));
    try {
      items = await listAgendaItems();
      renderManage();
      await loadDay();
    } catch (err) {
      toast(errorMessage(err, 'No se pudieron cargar tus pendientes.'), 'error');
      clear(dayList);
      dayList.append(el('p', { class: 'goal-empty' }, ['No se pudo cargar.']));
      clear(manageList);
      manageList.append(el('p', { class: 'goal-empty' }, ['No se pudo cargar.']));
    }
  }

  async function loadDay(): Promise<void> {
    const dateISO = toISODate(currentDate);
    dayLabel.textContent = formatDayLabel(currentDate);
    clear(dayList);
    dayList.append(el('div', { class: 'spinner spinner--sm', 'aria-hidden': 'true' }));
    try {
      const logs = await getAgendaLogsForRange(dateISO, dateISO);
      completion = new Map(logs.map((l) => [key(l.agenda_item_id, l.occurrence_date), l.completed]));
      renderDay();
    } catch (err) {
      toast(errorMessage(err, 'No se pudo cargar el día.'), 'error');
      clear(dayList);
      dayList.append(el('p', { class: 'goal-empty' }, ['No se pudo cargar.']));
    }
  }

  function renderDay(): void {
    const dateISO = toISODate(currentDate);
    clear(dayList);
    const occurrences = occurrencesForDate(items, dateISO);
    if (occurrences.length === 0) {
      dayList.append(el('p', { class: 'goal-empty' }, ['Nada agendado para este día.']));
      return;
    }
    for (const item of occurrences) dayList.append(renderDayRow(item, dateISO));
  }

  function renderDayRow(item: AgendaItem, dateISO: string): HTMLElement {
    const done = completion.get(key(item.id, dateISO)) ?? false;
    const toggleBtn = el(
      'button',
      {
        class: 'goal-check' + (done ? ' goal-check--on' : ''),
        type: 'button',
        'aria-label': done ? 'Marcar como pendiente' : 'Marcar como hecho',
      },
      [icons.check()],
    );
    toggleBtn.addEventListener('click', () => void onToggle(item, dateISO));

    const bodyChildren: (Node | string)[] = [
      el('div', { class: 'agenda-item__head' }, [
        el('span', { class: 'agenda-item__time' }, [formatTime(item.time_of_day)]),
        el('span', { class: 'agenda-item__title' }, [item.title]),
      ]),
    ];
    if (item.note) bodyChildren.push(el('p', { class: 'agenda-item__note' }, [item.note]));

    return el('div', { class: 'agenda-item' + (done ? ' agenda-item--done' : '') }, [
      toggleBtn,
      el('div', { class: 'agenda-item__body' }, bodyChildren),
    ]);
  }

  function renderManage(): void {
    clear(manageList);
    if (items.length === 0) {
      manageList.append(el('p', { class: 'goal-empty' }, ['Todavía no tienes pendientes agendados.']));
      return;
    }
    const sorted = [...items].sort((a, b) => a.time_of_day.slice(0, 5).localeCompare(b.time_of_day.slice(0, 5)));
    for (const item of sorted) manageList.append(renderManageRow(item));
  }

  function renderManageRow(item: AgendaItem): HTMLElement {
    const dot = el('span', { class: 'agenda-item__dot' });
    dot.style.setProperty('--dot', item.color);

    const editBtn = el(
      'button',
      { class: 'iconbtn', type: 'button', 'aria-label': `Editar ${item.title}` },
      [icons.pencil()],
    );
    editBtn.addEventListener('click', () => void onEdit(item));

    const delBtn = el(
      'button',
      { class: 'iconbtn iconbtn--danger', type: 'button', 'aria-label': `Eliminar ${item.title}` },
      [icons.trash()],
    );
    delBtn.addEventListener('click', () => void onDelete(item));

    return el('div', { class: 'agenda-item agenda-item--manage' }, [
      dot,
      el('div', { class: 'agenda-item__body' }, [
        el('div', { class: 'agenda-item__head' }, [
          el('span', { class: 'agenda-item__time' }, [formatTime(item.time_of_day)]),
          el('span', { class: 'agenda-item__title' }, [item.title]),
        ]),
        el('span', { class: 'agenda-item__recurrence' }, [describeRecurrence(item)]),
      ]),
      el('div', { class: 'goal-card__actions' }, [editBtn, delBtn]),
    ]);
  }

  async function onAdd(): Promise<void> {
    const result = await openAgendaItemForm(undefined, toISODate(currentDate));
    if (!result) return;
    try {
      const created = await createAgendaItem(userId, {
        title: result.title,
        note: result.note,
        time_of_day: result.timeOfDay,
        recurrence: result.recurrence,
        weekdays: result.weekdays,
        start_date: result.startDate,
        end_date: result.endDate,
        color: result.color,
      });
      items.push(created);
      renderManage();
      renderDay();
      toast('Pendiente agendado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo crear el pendiente.'), 'error');
    }
  }

  async function onEdit(item: AgendaItem): Promise<void> {
    const result = await openAgendaItemForm({
      title: item.title,
      note: item.note,
      timeOfDay: item.time_of_day,
      recurrence: item.recurrence,
      weekdays: item.weekdays,
      startDate: item.start_date,
      endDate: item.end_date,
      color: item.color,
    });
    if (!result) return;
    try {
      await updateAgendaItem(item.id, {
        title: result.title,
        note: result.note,
        time_of_day: result.timeOfDay,
        recurrence: result.recurrence,
        weekdays: result.weekdays,
        start_date: result.startDate,
        end_date: result.endDate,
        color: result.color,
      });
      item.title = result.title;
      item.note = result.note;
      item.time_of_day = result.timeOfDay;
      item.recurrence = result.recurrence;
      item.weekdays = result.weekdays;
      item.start_date = result.startDate;
      item.end_date = result.endDate;
      item.color = result.color;
      renderManage();
      renderDay();
      toast('Pendiente actualizado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo actualizar.'), 'error');
    }
  }

  async function onDelete(item: AgendaItem): Promise<void> {
    const ok = await confirmDialog(`¿Eliminar "${item.title}"? También se borrarán sus registros de cumplimiento.`);
    if (!ok) return;
    try {
      await deleteAgendaItem(item.id);
      items = items.filter((i) => i.id !== item.id);
      renderManage();
      renderDay();
      toast('Pendiente eliminado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo eliminar.'), 'error');
    }
  }

  async function onToggle(item: AgendaItem, dateISO: string): Promise<void> {
    const k = key(item.id, dateISO);
    const next = !(completion.get(k) ?? false);
    completion.set(k, next);
    renderDay();
    try {
      await setAgendaCompletion(userId, item.id, dateISO, next);
    } catch (err) {
      completion.set(k, !next);
      renderDay();
      toast(errorMessage(err, 'No se pudo actualizar.'), 'error');
    }
  }
}
