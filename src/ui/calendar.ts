import { el, clear } from './dom';
import { DAY_LABELS, capitalize, mondayFirstDay } from '../lib/dates';
import { icons } from './icons';

interface DatePicker {
  element: HTMLElement;
  getValue(): string | null;
  /** Cambia la fecha mínima seleccionable; si la selección actual queda antes, se limpia. */
  setMin(minISO: string | null): void;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthYearLabel(year: number, month: number): string {
  return capitalize(new Date(year, month, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }));
}

/**
 * Calendario inline de un solo mes: se navega con flechas y se elige un día
 * con un clic (nada de escribir la fecha a mano). `min` deshabilita, visual
 * y funcionalmente, cualquier día anterior a esa fecha.
 */
export function createDatePicker(opts: {
  initial?: string | null;
  min?: string | null;
  onChange?: (iso: string | null) => void;
}): DatePicker {
  let selected: string | null = opts.initial ?? null;
  let minISO: string | null = opts.min ?? null;

  const seed = (selected ?? minISO)?.split('-').map(Number) ?? null;
  let viewYear = seed ? seed[0] : new Date().getFullYear();
  let viewMonth = seed ? seed[1] - 1 : new Date().getMonth();

  const monthLabel = el('span', { class: 'cal__month-label' });
  const prevBtn = el('button', { type: 'button', class: 'cal__nav', 'aria-label': 'Mes anterior' }, [
    icons.chevronLeft(),
  ]);
  const nextBtn = el('button', { type: 'button', class: 'cal__nav', 'aria-label': 'Mes siguiente' }, [
    icons.chevronRight(),
  ]);
  const grid = el('div', { class: 'cal__grid' });
  const root = el('div', { class: 'cal' }, [
    el('div', { class: 'cal__header' }, [prevBtn, monthLabel, nextBtn]),
    el(
      'div',
      { class: 'cal__weekdays' },
      DAY_LABELS.map((d) => el('span', {}, [d])),
    ),
    grid,
  ]);

  function changeMonth(delta: number): void {
    viewMonth += delta;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    } else if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
    render();
  }
  prevBtn.addEventListener('click', () => changeMonth(-1));
  nextBtn.addEventListener('click', () => changeMonth(1));

  function render(): void {
    monthLabel.textContent = monthYearLabel(viewYear, viewMonth);
    clear(grid);

    const firstWeekday = mondayFirstDay(new Date(viewYear, viewMonth, 1));
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    for (let i = 0; i < firstWeekday; i++) {
      grid.append(el('span', { class: 'cal__cell cal__cell--empty' }));
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      const disabled = Boolean(minISO && iso < minISO);
      const cell = el(
        'button',
        {
          type: 'button',
          class:
            'cal__cell' +
            (iso === selected ? ' cal__cell--selected' : '') +
            (iso === todayISO ? ' cal__cell--today' : '') +
            (disabled ? ' cal__cell--disabled' : ''),
          disabled,
          'aria-label': iso,
        },
        [String(d)],
      );
      if (!disabled) {
        cell.addEventListener('click', () => {
          selected = iso;
          render();
          opts.onChange?.(selected);
        });
      }
      grid.append(cell);
    }
  }
  render();

  return {
    element: root,
    getValue: () => selected,
    setMin: (m) => {
      minISO = m;
      if (selected && minISO && selected < minISO) {
        selected = null;
        opts.onChange?.(null);
      }
      render();
    },
  };
}
