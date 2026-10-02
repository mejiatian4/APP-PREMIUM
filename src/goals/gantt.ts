import type { Goal } from '../lib/types';
import { toISODate, formatShortDate, capitalize } from '../lib/dates';
import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { TERMS, TERM_LABELS } from './constants';

// Ancho de cada columna de mes: se calcula según el espacio real disponible
// (ver más abajo), entre estos dos límites — compacto en pantallas angostas,
// sin estirarse de forma absurda cuando hay pocos meses en una tarjeta ancha.
const MONTH_WIDTH_MIN_PX = 90;
const MONTH_WIDTH_MAX_PX = 260;
// Debe coincidir con el ancho fijo de .gantt__labels en main.css.
const LABELS_WIDTH_PX = 170;

type DatedGoal = Goal & { start_date: string; end_date: string };

function monthLabel(year: number, month: number): string {
  return capitalize(new Date(year, month, 1).toLocaleDateString('es', { month: 'long' }));
}

function daysInMonthOf(dateISO: string): number {
  const [y, m] = dateISO.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Pinta el cronograma (Gantt) de las metas que tienen fecha de inicio y fin.
 * Las metas sin ambas fechas no participan del cronograma, pero sí siguen
 * apareciendo en el tablero de columnas.
 */
export function renderGantt(container: HTMLElement, goals: Goal[]): void {
  clear(container);

  const dated = goals.filter((g): g is DatedGoal => Boolean(g.start_date && g.end_date));

  if (dated.length === 0) {
    container.append(
      el('p', { class: 'state__text gantt__empty' }, [
        'Agrega fecha de inicio y fin a tus metas para verlas aquí en el cronograma.',
      ]),
    );
    return;
  }

  const todayISO = toISODate(new Date());

  let minDateISO = dated[0].start_date;
  let maxDateISO = dated[0].end_date;
  for (const g of dated) {
    if (g.start_date < minDateISO) minDateISO = g.start_date;
    if (g.end_date > maxDateISO) maxDateISO = g.end_date;
  }
  if (minDateISO > todayISO) minDateISO = todayISO;
  if (maxDateISO < todayISO) maxDateISO = todayISO;

  const [minY, minM] = minDateISO.split('-').map(Number);
  const [maxY, maxM] = maxDateISO.split('-').map(Number);
  const rangeStartYear = minY;
  const rangeStartMonth = minM - 1; // 0-based
  const monthsCount = (maxY - minY) * 12 + (maxM - minM) + 1;

  // `container` ya está en la página con su ancho real (a diferencia de
  // `.gantt`, que se ajusta a su propio contenido — medirlo a él mismo
  // después sería circular). A partir de eso repartimos el espacio
  // disponible entre los meses, respetando el mínimo/máximo de arriba.
  const availableWidth = container.clientWidth - LABELS_WIDTH_PX;
  const monthWidthPx = Math.min(
    MONTH_WIDTH_MAX_PX,
    Math.max(MONTH_WIDTH_MIN_PX, availableWidth / monthsCount),
  );

  const months: { year: number; month: number }[] = [];
  for (let i = 0; i < monthsCount; i++) {
    const total = rangeStartMonth + i;
    months.push({ year: rangeStartYear + Math.floor(total / 12), month: ((total % 12) + 12) % 12 });
  }

  /** Posición de una fecha en "unidades de mes" relativas al inicio del rango. */
  function monthUnits(dateISO: string): number {
    const [y, m, d] = dateISO.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthOffset = (y - rangeStartYear) * 12 + (m - 1 - rangeStartMonth);
    return monthOffset + (d - 1) / daysInMonth;
  }

  const timelineWidth = monthsCount * monthWidthPx;

  const header = el(
    'div',
    { class: 'gantt__header' },
    months.map(({ year, month }) =>
      el('div', { class: 'gantt__month', style: `width:${monthWidthPx}px` }, [monthLabel(year, month)]),
    ),
  );

  const clampedToday = todayISO < minDateISO ? minDateISO : todayISO > maxDateISO ? maxDateISO : todayISO;
  const todayLeftPct = (monthUnits(clampedToday) / monthsCount) * 100;
  const todayLine = el('div', { class: 'gantt__today', style: `left:${todayLeftPct}%` }, [
    el('span', { class: 'gantt__today-label' }, ['Hoy']),
  ]);

  const labelItems: HTMLElement[] = [];
  const rowItems: HTMLElement[] = [];

  for (const term of TERMS) {
    const termGoals = dated
      .filter((g) => g.term === term)
      .sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));
    if (termGoals.length === 0) continue;

    labelItems.push(el('div', { class: 'gantt__group-label' }, [TERM_LABELS[term]]));
    rowItems.push(el('div', { class: 'gantt__group-spacer' }));

    for (const goal of termGoals) {
      const left = monthUnits(goal.start_date);
      const right = monthUnits(goal.end_date) + 1 / daysInMonthOf(goal.end_date);
      const leftPct = (left / monthsCount) * 100;
      const widthPct = Math.max(((right - left) / monthsCount) * 100, 1.2);
      const overdue = !goal.completed && goal.end_date < todayISO;

      const barChildren: Node[] = [];
      if (goal.completed) barChildren.push(icons.check());

      const bar = el(
        'div',
        {
          class:
            'gantt__bar' +
            ` gantt__bar--${term}` +
            (goal.completed ? ' gantt__bar--done' : '') +
            (overdue ? ' gantt__bar--overdue' : ''),
          style: `left:${leftPct}%; width:${widthPct}%`,
          title: `${goal.title} · ${formatShortDate(goal.start_date)} – ${formatShortDate(goal.end_date)}`,
        },
        barChildren,
      );

      labelItems.push(el('div', { class: 'gantt__row-label', title: goal.title }, [goal.title]));
      rowItems.push(el('div', { class: 'gantt__row' }, [bar]));
    }
  }

  const labelsCol = el('div', { class: 'gantt__labels' }, [
    el('div', { class: 'gantt__labels-spacer' }),
    ...labelItems,
  ]);
  const body = el(
    'div',
    { class: 'gantt__body', style: `background-size:${monthWidthPx}px 100%` },
    [todayLine, ...rowItems],
  );
  const timeline = el('div', { class: 'gantt__timeline', style: `width:${timelineWidth}px` }, [header, body]);
  const scrollArea = el('div', { class: 'gantt__scroll' }, [timeline]);

  container.append(el('div', { class: 'gantt' }, [labelsCol, scrollArea]));

  // Las etiquetas y las filas de la barra son dos columnas independientes
  // que se apilan en paralelo (no una sola tabla): si un título largo pasa
  // a dos líneas, igualamos la altura de esa fila con la de su barra para
  // que no se desalineen entre sí ni con las filas de abajo.
  for (let i = 0; i < labelItems.length; i++) {
    const h = Math.max(labelItems[i].scrollHeight, rowItems[i].scrollHeight);
    labelItems[i].style.height = `${h}px`;
    rowItems[i].style.height = `${h}px`;
  }
}
