import type { Habit, CompletionMap } from '../lib/types';
import {
  startOfWeek,
  weekDays,
  addWeeks,
  addDays,
  daysBetween,
  toISODate,
  isSameDay,
  formatWeekRange,
  DAY_LABELS,
  DAY_NAMES,
} from '../lib/dates';
import {
  listHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  getLogsForRange,
  setCompletion,
} from './api';
import { DailyChart } from '../charts/daily';
import { WeeklyChart } from '../charts/weekly';
import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { toast, errorMessage } from '../ui/toast';
import { openHabitForm, confirmDialog } from '../ui/modal';
import { signOut } from '../auth/auth';
import { renderGoalsBoard } from '../goals/board';
import { openSettingsPanel } from '../settings/panel';
import { createQuoteCard } from '../ui/quotes';
import { renderCoachChat } from '../coach/chat';

const key = (habitId: string, dateISO: string) => `${habitId}|${dateISO}`;

export function renderDashboard(root: HTMLElement, userId: string, userEmail: string): void {
  clear(root);

  // ---- Estado ----
  let currentMonday = startOfWeek(new Date());
  let habits: Habit[] = [];
  let completion: CompletionMap = new Map();

  // ---- Layout estático (se construye una vez) ----
  const brand = el('div', { class: 'brand' }, [
    el('img', {
      class: 'brand__mark',
      src: `${import.meta.env.BASE_URL}logo-kroton-naranja.png`,
      alt: 'Kroton',
    }),
  ]);

  const settingsBtn = el('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'Configuración' }, [
    icons.settings(),
  ]);
  settingsBtn.addEventListener('click', () => openSettingsPanel(userEmail));

  const logoutBtn = el('button', { class: 'btn btn--ghost btn--icon-text' }, [
    icons.logout(),
    el('span', {}, ['Salir']),
  ]);
  logoutBtn.addEventListener('click', () => void signOut());

  const shopLink = el(
    'a',
    { class: 'topbar__shop', href: 'https://krotonoficial.com/', target: '_blank', rel: 'noopener' },
    [icons.shop(), el('span', {}, ['Ir a la tienda'])],
  );

  const topbar = el('header', { class: 'topbar' }, [
    brand,
    el('div', { class: 'topbar__user' }, [
      shopLink,
      el('span', { class: 'topbar__email', title: userEmail }, [userEmail]),
      settingsBtn,
      logoutBtn,
    ]),
  ]);

  const headerHero = el('div', { class: 'header-hero' }, [
    el('span', { class: 'header-hero__kicker' }, ['Hábitos · Metas & Coach']),
    el('p', { class: 'header-hero__desc' }, [
      'Registra tus hábitos día a día, organiza tus metas y recibe orientación personalizada de tu coach con inteligencia artificial.',
    ]),
  ]);

  // Tarjeta: progreso de hoy (dona)
  const dailyCanvas = el('canvas', { 'aria-label': 'Progreso de hoy' }) as HTMLCanvasElement;
  const dailyCard = el('section', { class: 'card card--daily' }, [
    el('div', { class: 'card__head' }, [el('h2', { class: 'card__title' }, ['Hoy'])]),
    el('div', { class: 'donut-wrap' }, [dailyCanvas]),
  ]);

  // Tarjeta: resumen semanal (barras + métricas)
  const weeklyCanvas = el('canvas', { 'aria-label': 'Resumen semanal' }) as HTMLCanvasElement;
  const streakValue = el('span', { class: 'stat__value' }, ['0']);
  const weekPctValue = el('span', { class: 'stat__value' }, ['0%']);
  const weeklyCard = el('section', { class: 'card card--weekly' }, [
    el('div', { class: 'card__head' }, [
      el('h2', { class: 'card__title' }, ['Resumen semanal']),
      el('div', { class: 'stats' }, [
        el('div', { class: 'stat stat--flame' }, [
          icons.flame(),
          el('div', { class: 'stat__body' }, [
            streakValue,
            el('span', { class: 'stat__label' }, ['días de racha']),
          ]),
        ]),
        el('div', { class: 'stat' }, [
          el('div', { class: 'stat__body' }, [
            weekPctValue,
            el('span', { class: 'stat__label' }, ['de la semana']),
          ]),
        ]),
      ]),
    ]),
    el('div', { class: 'bars-wrap' }, [weeklyCanvas]),
  ]);

  const overview = el('div', { class: 'overview' }, [dailyCard, weeklyCard]);

  // Tarjeta: consistencia (mejor racha, % del mes y mapa de calor)
  const bestStreakValue = el('span', { class: 'stat__value' }, ['0']);
  const monthPctValue = el('span', { class: 'stat__value' }, ['0%']);
  const heatmapGrid = el('div', { class: 'heatmap__grid' });
  const consistencyCard = el('section', { class: 'card card--consistency' }, [
    el('div', { class: 'card__head' }, [
      el('h2', { class: 'card__title' }, ['Consistencia']),
      el('div', { class: 'stats' }, [
        el('div', { class: 'stat stat--trophy' }, [
          icons.trophy(),
          el('div', { class: 'stat__body' }, [
            bestStreakValue,
            el('span', { class: 'stat__label' }, ['mejor racha']),
          ]),
        ]),
        el('div', { class: 'stat' }, [
          el('div', { class: 'stat__body' }, [
            monthPctValue,
            el('span', { class: 'stat__label' }, ['del mes']),
          ]),
        ]),
      ]),
    ]),
    el('div', { class: 'heatmap' }, [
      el(
        'div',
        { class: 'heatmap__days' },
        DAY_LABELS.map((d) => el('span', {}, [d])),
      ),
      heatmapGrid,
    ]),
  ]);

  // Tarjeta: % de éxito por hábito (últimos 30 días)
  const habitStatsList = el('div', { class: 'habit-stats' });
  const habitStatsCard = el('section', { class: 'card card--habitstats' }, [
    el('div', { class: 'card__head' }, [el('h2', { class: 'card__title' }, ['Por hábito · 30 días'])]),
    habitStatsList,
  ]);

  const statsGrid = el('div', { class: 'stats-grid' }, [consistencyCard, habitStatsCard]);

  // Sección de la semana: navegación + tabla
  const rangeLabel = el('span', { class: 'weeknav__range' }, ['—']);
  const prevBtn = el('button', { class: 'btn btn--icon', 'aria-label': 'Semana anterior' }, [
    icons.chevronLeft(),
  ]);
  const nextBtn = el('button', { class: 'btn btn--icon', 'aria-label': 'Semana siguiente' }, [
    icons.chevronRight(),
  ]);
  const todayBtn = el('button', { class: 'btn btn--soft' }, ['Hoy']);
  const addBtn = el('button', { class: 'btn btn--primary btn--icon-text' }, [
    icons.plus(),
    el('span', {}, ['Hábito']),
  ]);

  prevBtn.addEventListener('click', () => {
    currentMonday = addWeeks(currentMonday, -1);
    void loadWeek();
  });
  nextBtn.addEventListener('click', () => {
    currentMonday = addWeeks(currentMonday, 1);
    void loadWeek();
  });
  todayBtn.addEventListener('click', () => {
    currentMonday = startOfWeek(new Date());
    void loadWeek();
  });
  addBtn.addEventListener('click', () => void onAddHabit());

  const weeknav = el('div', { class: 'weeknav' }, [
    el('div', { class: 'weeknav__left' }, [prevBtn, rangeLabel, nextBtn, todayBtn]),
    addBtn,
  ]);

  const tableWrap = el('div', { class: 'table-wrap' });
  const weekSection = el('section', { class: 'week' }, [weeknav, tableWrap]);

  // ---- Pestañas: Hábitos / Metas / Coach ----
  const habitsView = el('div', { class: 'view' }, [createQuoteCard(), overview, weekSection, statsGrid]);
  const goalsView = el('div', { class: 'view', style: 'display:none' });
  const coachView = el('div', { class: 'view', style: 'display:none' });

  const tabHabits = el('button', { class: 'tab tab--active', type: 'button' }, ['Hábitos']);
  const tabGoals = el('button', { class: 'tab', type: 'button' }, ['Metas']);
  const tabCoach = el('button', { class: 'tab', type: 'button' }, ['Coach']);
  const tabs = el('div', { class: 'tabs' }, [tabHabits, tabGoals, tabCoach]);

  let goalsLoaded = false;
  let coachLoaded = false;
  function showView(view: 'habits' | 'goals' | 'coach'): void {
    habitsView.style.display = view === 'habits' ? '' : 'none';
    goalsView.style.display = view === 'goals' ? '' : 'none';
    coachView.style.display = view === 'coach' ? '' : 'none';
    tabHabits.classList.toggle('tab--active', view === 'habits');
    tabGoals.classList.toggle('tab--active', view === 'goals');
    tabCoach.classList.toggle('tab--active', view === 'coach');
    if (view === 'goals' && !goalsLoaded) {
      goalsLoaded = true;
      void renderGoalsBoard(goalsView, userId);
    }
    if (view === 'coach' && !coachLoaded) {
      coachLoaded = true;
      renderCoachChat(coachView);
    }
  }
  tabHabits.addEventListener('click', () => showView('habits'));
  tabGoals.addEventListener('click', () => showView('goals'));
  tabCoach.addEventListener('click', () => showView('coach'));

  const main = el('main', { class: 'dashboard' }, [tabs, habitsView, goalsView, coachView]);
  root.append(el('div', { class: 'app' }, [topbar, headerHero, main]));

  // Los canvas ya están en el DOM: ahora sí se pueden crear las gráficas.
  const dailyChart = new DailyChart(dailyCanvas);
  const weeklyChart = new WeeklyChart(weeklyCanvas);

  // ---- Carga inicial ----
  void loadWeek();

  // ----------------------------------------------------------------
  //  Carga de datos de la semana visible
  // ----------------------------------------------------------------
  async function loadWeek(): Promise<void> {
    rangeLabel.textContent = formatWeekRange(currentMonday);
    showTableLoading();

    const days = weekDays(currentMonday);
    const startISO = toISODate(days[0]);
    const endISO = toISODate(days[6]);
    const todayISO = toISODate(new Date());

    try {
      habits = await listHabits();

      const logs = await getLogsForRange(startISO, endISO);
      completion = new Map();
      for (const log of logs) {
        if (log.completed) completion.set(key(log.habit_id, log.log_date), true);
      }

      // Si hoy no cae dentro de la semana visible, traemos su estado aparte
      // para que la dona de "Hoy" siempre sea correcta.
      const todayInWeek = days.some((d) => isSameDay(d, new Date()));
      if (!todayInWeek) {
        const todayLogs = await getLogsForRange(todayISO, todayISO);
        for (const log of todayLogs) {
          if (log.completed) completion.set(key(log.habit_id, log.log_date), true);
        }
      }

      renderTable(days, todayISO);
      recomputeCharts(days, todayISO);
      await refreshStats();
    } catch (err) {
      toast(errorMessage(err, 'No se pudieron cargar tus hábitos.'), 'error');
      renderError();
    }
  }

  // ----------------------------------------------------------------
  //  Render de la tabla semanal
  // ----------------------------------------------------------------
  function renderTable(days: Date[], todayISO: string): void {
    clear(tableWrap);

    if (habits.length === 0) {
      tableWrap.append(renderEmptyState());
      return;
    }

    // Cabecera
    const headCells: HTMLElement[] = [el('th', { class: 'ht__habit-head' }, ['Hábito'])];
    days.forEach((d, i) => {
      const isToday = toISODate(d) === todayISO;
      headCells.push(
        el('th', { class: 'ht__day-head' + (isToday ? ' is-today' : '') }, [
          el('span', { class: 'ht__day-name' }, [DAY_LABELS[i]]),
          el('span', { class: 'ht__day-num' }, [String(d.getDate())]),
        ]),
      );
    });
    headCells.push(el('th', { class: 'ht__week-head' }, ['Semana']));
    headCells.push(el('th', { class: 'ht__actions-head', 'aria-label': 'Acciones' }, ['']));

    const thead = el('thead', {}, [el('tr', {}, headCells)]);

    // Filas
    const rows = habits.map((habit) => {
      const cells: HTMLElement[] = [];

      // Nombre del hábito con punto de color
      const dot = el('span', { class: 'ht__dot', 'aria-hidden': 'true' });
      dot.style.setProperty('--dot', habit.color);
      cells.push(
        el('td', { class: 'ht__habit' }, [
          el('div', { class: 'ht__habit-inner' }, [dot, el('span', {}, [habit.name])]),
        ]),
      );

      // Casillas por día
      let weekDone = 0;
      days.forEach((d, i) => {
        const dateISO = toISODate(d);
        const done = completion.get(key(habit.id, dateISO)) === true;
        if (done) weekDone++;
        const isToday = dateISO === todayISO;

        const box = el('button', {
          class: 'check' + (done ? ' check--on' : '') + (isToday ? ' check--today' : ''),
          role: 'checkbox',
          'aria-checked': String(done),
          'aria-label': `${DAY_NAMES[i]} ${d.getDate()}, ${habit.name}`,
          type: 'button',
        }, [icons.check()]);
        box.style.setProperty('--habit', habit.color);
        box.addEventListener('click', () => void onToggle(habit, dateISO, box));

        cells.push(
          el(
            'td',
            { class: 'ht__cell' + (isToday ? ' is-today' : ''), 'data-day-label': DAY_LABELS[i] },
            [box],
          ),
        );
      });

      // Cumplimiento del hábito en la semana
      cells.push(
        el('td', { class: 'ht__week' }, [
          el('span', { class: 'ht__week-frac' }, [`${weekDone}/7`]),
        ]),
      );

      // Acciones (editar / eliminar)
      const editBtn = el('button', { class: 'iconbtn', 'aria-label': `Editar ${habit.name}`, type: 'button' }, [
        icons.pencil(),
      ]);
      const delBtn = el('button', { class: 'iconbtn iconbtn--danger', 'aria-label': `Eliminar ${habit.name}`, type: 'button' }, [
        icons.trash(),
      ]);
      editBtn.addEventListener('click', () => void onEditHabit(habit));
      delBtn.addEventListener('click', () => void onDeleteHabit(habit));
      cells.push(el('td', { class: 'ht__actions' }, [el('div', { class: 'ht__actions-inner' }, [editBtn, delBtn])]));

      return el('tr', {}, cells);
    });

    const table = el('table', { class: 'ht' }, [thead, el('tbody', {}, rows)]);
    tableWrap.append(table);
  }

  // ----------------------------------------------------------------
  //  Marcar / desmarcar una casilla (actualización optimista)
  // ----------------------------------------------------------------
  async function onToggle(habit: Habit, dateISO: string, box: HTMLElement): Promise<void> {
    const wasDone = completion.get(key(habit.id, dateISO)) === true;
    const next = !wasDone;

    // Optimista: actualizamos la UI de inmediato.
    setBox(box, next, habit.color);
    if (next) completion.set(key(habit.id, dateISO), true);
    else completion.delete(key(habit.id, dateISO));

    const days = weekDays(currentMonday);
    const todayISO = toISODate(new Date());
    updateWeekFraction(box, habit.id, days);
    recomputeCharts(days, todayISO);

    try {
      await setCompletion(userId, habit.id, dateISO, next);
      // Las estadísticas solo cambian si tocamos una fecha dentro de sus ventanas.
      await refreshStats();
    } catch (err) {
      // Revertir si falla.
      setBox(box, wasDone, habit.color);
      if (wasDone) completion.set(key(habit.id, dateISO), true);
      else completion.delete(key(habit.id, dateISO));
      updateWeekFraction(box, habit.id, days);
      recomputeCharts(days, todayISO);
      toast(errorMessage(err, 'No se pudo guardar el cambio.'), 'error');
    }
  }

  function setBox(box: HTMLElement, on: boolean, color: string): void {
    box.classList.toggle('check--on', on);
    box.setAttribute('aria-checked', String(on));
    box.style.setProperty('--habit', color);
  }

  /** Recalcula el "x/7" de la fila a la que pertenece la casilla. */
  function updateWeekFraction(box: HTMLElement, habitId: string, days: Date[]): void {
    const row = box.closest('tr');
    if (!row) return;
    const frac = row.querySelector('.ht__week-frac');
    if (!frac) return;
    let done = 0;
    for (const d of days) if (completion.get(key(habitId, toISODate(d))) === true) done++;
    frac.textContent = `${done}/7`;
  }

  // ----------------------------------------------------------------
  //  Gráficas
  // ----------------------------------------------------------------
  function recomputeCharts(days: Date[], todayISO: string): void {
    const total = habits.length;

    // Dona: progreso de HOY.
    let todayDone = 0;
    for (const h of habits) if (completion.get(key(h.id, todayISO)) === true) todayDone++;
    dailyChart.update(todayDone, total);

    // Barras: % por día de la semana visible.
    const percentages = days.map((d) => {
      if (total === 0) return 0;
      const iso = toISODate(d);
      let done = 0;
      for (const h of habits) if (completion.get(key(h.id, iso)) === true) done++;
      return (done / total) * 100;
    });
    const todayIndex = days.findIndex((d) => toISODate(d) === todayISO);
    weeklyChart.update(percentages, todayIndex);

    // Métrica: % de cumplimiento de la semana visible.
    const cells = total * 7;
    const filled = percentages.reduce((sum, p) => sum + (p / 100) * total, 0);
    weekPctValue.textContent = cells > 0 ? `${Math.round((filled / cells) * 100)}%` : '0%';
  }

  /**
   * Estadísticas extendidas: racha actual, mejor racha histórica, % de
   * consistencia del mes, mapa de calor (10 semanas) y % de éxito por hábito
   * (últimos 30 días). Se calculan a partir de una sola consulta.
   */
  async function refreshStats(): Promise<void> {
    try {
      const today = new Date();
      const lookbackDays = 371; // ~53 semanas: cubre el mapa de calor y la racha histórica
      const startISO = toISODate(addDays(today, -(lookbackDays - 1)));
      const endISO = toISODate(today);
      const logs = await getLogsForRange(startISO, endISO);

      const activeDays = new Set<string>();
      const doneCountByDay = new Map<string, number>();
      const perHabitDone = new Map<string, number>();
      const monthStartISO = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
      const last30StartISO = toISODate(addDays(today, -29));

      for (const log of logs) {
        if (!log.completed) continue;
        activeDays.add(log.log_date);
        doneCountByDay.set(log.log_date, (doneCountByDay.get(log.log_date) ?? 0) + 1);
        if (log.log_date >= last30StartISO) {
          perHabitDone.set(log.habit_id, (perHabitDone.get(log.habit_id) ?? 0) + 1);
        }
      }

      // Racha actual: días consecutivos (hasta hoy) con al menos un hábito completado.
      let streak = 0;
      let cursor = new Date(today);
      if (!activeDays.has(toISODate(cursor))) cursor = addDays(cursor, -1);
      while (activeDays.has(toISODate(cursor))) {
        streak++;
        cursor = addDays(cursor, -1);
      }
      streakValue.textContent = String(streak);

      // Mejor racha dentro de la ventana consultada.
      let best = 0;
      let run = 0;
      for (let i = 0; i < lookbackDays; i++) {
        const dISO = toISODate(addDays(today, -(lookbackDays - 1) + i));
        if (activeDays.has(dISO)) {
          run++;
          best = Math.max(best, run);
        } else {
          run = 0;
        }
      }
      bestStreakValue.textContent = String(Math.max(best, streak));

      // % de días del mes (hasta hoy) con al menos un hábito completado.
      let monthActiveDays = 0;
      for (const dateISO of activeDays) if (dateISO >= monthStartISO) monthActiveDays++;
      const daysElapsedInMonth = today.getDate();
      monthPctValue.textContent = `${Math.round((monthActiveDays / daysElapsedInMonth) * 100)}%`;

      renderHeatmap(doneCountByDay, today);
      renderHabitStats(perHabitDone, today, last30StartISO);
    } catch {
      // Las estadísticas extendidas son secundarias: si fallan, no interrumpimos la experiencia.
    }
  }

  /** Pinta el mapa de calor: 10 semanas (lunes a domingo) hasta la semana actual. */
  function renderHeatmap(doneCountByDay: Map<string, number>, today: Date): void {
    clear(heatmapGrid);
    const weeks = 10;
    const totalHabits = habits.length;
    const gridStart = addDays(startOfWeek(today), -(weeks - 1) * 7);
    const todayISO = toISODate(today);

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const dateISO = toISODate(addDays(gridStart, w * 7 + d));
        const cell = el('span', { class: 'heatmap__cell' });

        if (dateISO > todayISO || totalHabits === 0) {
          cell.classList.add('heatmap__cell--empty');
          cell.title = dateISO;
        } else {
          const done = doneCountByDay.get(dateISO) ?? 0;
          const pct = done / totalHabits;
          let level = 0;
          if (pct >= 1) level = 4;
          else if (pct >= 0.67) level = 3;
          else if (pct >= 0.34) level = 2;
          else if (pct > 0) level = 1;
          cell.classList.add(`heatmap__cell--l${level}`);
          cell.title = `${dateISO} · ${done}/${totalHabits}`;
        }
        heatmapGrid.append(cell);
      }
    }
  }

  /** Pinta el % de cumplimiento de cada hábito en los últimos 30 días. */
  function renderHabitStats(perHabitDone: Map<string, number>, today: Date, last30StartISO: string): void {
    clear(habitStatsList);
    if (habits.length === 0) {
      habitStatsList.append(el('p', { class: 'state__text' }, ['Agrega hábitos para ver tus estadísticas.']));
      return;
    }
    const todayISO = toISODate(today);
    for (const habit of habits) {
      const createdISO = toISODate(new Date(habit.created_at));
      const effectiveStartISO = createdISO > last30StartISO ? createdISO : last30StartISO;
      const daysConsidered = Math.max(1, daysBetween(effectiveStartISO, todayISO) + 1);
      const done = perHabitDone.get(habit.id) ?? 0;
      const pct = Math.min(100, Math.round((done / daysConsidered) * 100));

      const dot = el('span', { class: 'habit-stat__dot', 'aria-hidden': 'true' });
      dot.style.setProperty('--dot', habit.color);
      const fill = el('div', { class: 'habit-stat__fill' });
      fill.style.width = `${pct}%`;
      fill.style.background = habit.color;

      habitStatsList.append(
        el('div', { class: 'habit-stat' }, [
          dot,
          el('span', { class: 'habit-stat__name' }, [habit.name]),
          el('div', { class: 'habit-stat__bar' }, [fill]),
          el('span', { class: 'habit-stat__pct' }, [`${pct}%`]),
        ]),
      );
    }
  }

  // ----------------------------------------------------------------
  //  Acciones CRUD
  // ----------------------------------------------------------------
  async function onAddHabit(): Promise<void> {
    const result = await openHabitForm();
    if (!result) return;
    try {
      const position = habits.length;
      const created = await createHabit(userId, result.name, result.color, position);
      habits.push(created);
      const days = weekDays(currentMonday);
      renderTable(days, toISODate(new Date()));
      recomputeCharts(days, toISODate(new Date()));
      await refreshStats();
      toast('Hábito agregado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo crear el hábito.'), 'error');
    }
  }

  async function onEditHabit(habit: Habit): Promise<void> {
    const result = await openHabitForm({ name: habit.name, color: habit.color });
    if (!result) return;
    try {
      await updateHabit(habit.id, { name: result.name, color: result.color });
      habit.name = result.name;
      habit.color = result.color;
      const days = weekDays(currentMonday);
      renderTable(days, toISODate(new Date()));
      recomputeCharts(days, toISODate(new Date()));
      await refreshStats();
      toast('Hábito actualizado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo actualizar.'), 'error');
    }
  }

  async function onDeleteHabit(habit: Habit): Promise<void> {
    const ok = await confirmDialog(
      `¿Eliminar "${habit.name}"? También se borrarán sus registros.`,
    );
    if (!ok) return;
    try {
      await deleteHabit(habit.id);
      habits = habits.filter((h) => h.id !== habit.id);
      const days = weekDays(currentMonday);
      renderTable(days, toISODate(new Date()));
      recomputeCharts(days, toISODate(new Date()));
      await refreshStats();
      toast('Hábito eliminado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo eliminar.'), 'error');
    }
  }

  // ----------------------------------------------------------------
  //  Estados auxiliares de la tabla
  // ----------------------------------------------------------------
  function showTableLoading(): void {
    clear(tableWrap);
    tableWrap.append(
      el('div', { class: 'state' }, [
        el('div', { class: 'spinner', 'aria-hidden': 'true' }),
        el('p', { class: 'state__text' }, ['Cargando tu semana…']),
      ]),
    );
  }

  function renderError(): void {
    clear(tableWrap);
    const retry = el('button', { class: 'btn btn--soft' }, ['Reintentar']);
    retry.addEventListener('click', () => void loadWeek());
    tableWrap.append(
      el('div', { class: 'state' }, [
        el('p', { class: 'state__text' }, ['No se pudieron cargar los datos.']),
        retry,
      ]),
    );
  }

  function renderEmptyState(): HTMLElement {
    const cta = el('button', { class: 'btn btn--primary btn--icon-text' }, [
      icons.plus(),
      el('span', {}, ['Crear mi primer hábito']),
    ]);
    cta.addEventListener('click', () => void onAddHabit());
    return el('div', { class: 'empty' }, [
      el('div', { class: 'empty__mark', 'aria-hidden': 'true' }, [icons.check()]),
      el('h3', { class: 'empty__title' }, ['Aún no tienes hábitos']),
      el('p', { class: 'empty__text' }, [
        'Agrega el primero y empieza a marcar tus días. Lo verás reflejado en las gráficas al instante.',
      ]),
      cta,
    ]);
  }
}
