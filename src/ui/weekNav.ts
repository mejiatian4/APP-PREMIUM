import { el } from './dom';
import { icons } from './icons';

export interface WeekNav {
  element: HTMLElement;
  rangeLabel: HTMLElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  todayBtn: HTMLButtonElement;
}

/**
 * Barra "‹ rango › Hoy" + botón de agregar: la misma estructura que usan el
 * grid semanal de Hábitos y la Agenda (en modo día o semana). `prevLabel`/
 * `nextLabel` son opcionales porque la Agenda los recalcula ella misma según
 * el modo activo (día vs. semana) en vez de fijarlos una sola vez.
 */
export function createWeekNav(opts: {
  addLabel: string;
  prevLabel?: string;
  nextLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onAdd: () => void;
}): WeekNav {
  const rangeLabel = el('span', { class: 'weeknav__range' }, ['—']);
  const prevBtn = el('button', { class: 'btn btn--icon', 'aria-label': opts.prevLabel }, [icons.chevronLeft()]);
  const nextBtn = el('button', { class: 'btn btn--icon', 'aria-label': opts.nextLabel }, [icons.chevronRight()]);
  const todayBtn = el('button', { class: 'btn btn--soft' }, ['Hoy']);
  const addBtn = el('button', { class: 'btn btn--primary btn--icon-text' }, [
    icons.plus(),
    el('span', {}, [opts.addLabel]),
  ]);

  prevBtn.addEventListener('click', opts.onPrev);
  nextBtn.addEventListener('click', opts.onNext);
  todayBtn.addEventListener('click', opts.onToday);
  addBtn.addEventListener('click', opts.onAdd);

  const element = el('div', { class: 'weeknav' }, [
    el('div', { class: 'weeknav__left' }, [prevBtn, rangeLabel, nextBtn, todayBtn]),
    addBtn,
  ]);

  return { element, rangeLabel, prevBtn, nextBtn, todayBtn };
}
