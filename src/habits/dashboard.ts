import type { Habit, CompletionMap } from '../lib/types';
import {
  startOfWeek,
  weekDays,
  addWeeks,
  addDays,
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
import { computeHabitCompletionPct } from './stats';
import { DailyChart } from '../charts/daily';
import { WeeklyChart } from '../charts/weekly';
import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { toast, errorMessage } from '../ui/toast';
import { openHabitForm, confirmDialog } from '../ui/modal';
import { createWeekNav } from '../ui/weekNav';
import { createEditDeleteButtons } from '../ui/rowActions';
import { signOut } from '../auth/auth';
import { renderGoalsBoard } from '../goals/board';
import { renderAgendaView } from '../agenda/agendaView';
import { openSettingsPanel } from '../settings/panel';
import { createQuoteCard } from '../ui/quotes';
import { mountCoachWidget } from '../coach/widget';
import { renderFitPlan } from '../fitplan/render';

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

  const topbar = el('header', { class: 'topbar' }, [
    settingsBtn,
    brand,
    el('div', { class: 'topbar__user' }, [
      el('span', { class: 'topbar__email', title: userEmail }, [userEmail]),
      logoutBtn,
    ]),
  ]);

  const heroKicker = el('span', { class: 'header-hero__kicker' }, ['Agenda · Hábitos · Metas & Coach']);
  const heroDesc = el('p', { class: 'header-hero__desc' }, [
    'Construye hábitos que se mantienen: organiza tu agenda, cumple tus metas y cuenta con un coach de IA que te acompaña en el camino.',
  ]);
  const headerHero = el('div', { class: 'header-hero' }, [heroKicker, heroDesc]);

  // ---- Subheader: secciones de la app (Hábitos / FitPlan) ----
  const navHabitos = el('button', { class: 'app-nav__item app-nav__item--active', type: 'button' }, ['Hábitos']);
  const navFitplan = el('button', { class: 'app-nav__item', type: 'button' }, ['FitPlan']);

  // Submenú de acceso rápido a Agenda/Hábitos/Metas: se despliega al
  // pasar el mouse por "Hábitos" (hover, en CSS) o al tocarlo en pantallas
  // táctiles (JS, más abajo). Las 3 vistas ya viven armadas en el DOM —ver
  // showView— así que elegir una aquí no vuelve a pedir datos si ya se
  // habían cargado antes: solo cambia cuál se muestra. El Coach no está
  // aquí: ahora es el botón flotante de abajo a la derecha (ver
  // mountCoachWidget), accesible desde cualquier sección.
  const quickAgenda = el('button', { class: 'app-nav__dropdown-item', type: 'button' }, ['Agenda']);
  const quickHabits = el('button', { class: 'app-nav__dropdown-item', type: 'button' }, ['Hábitos']);
  const quickGoals = el('button', { class: 'app-nav__dropdown-item', type: 'button' }, ['Metas']);
  const habitosDropdown = el('div', { class: 'app-nav__dropdown' }, [quickAgenda, quickHabits, quickGoals]);
  const navHabitosWrap = el('div', { class: 'app-nav__item-wrap' }, [navHabitos, habitosDropdown]);

  function closeHabitosDropdown(): void {
    navHabitosWrap.classList.remove('app-nav__item-wrap--open');
  }
  function goToSubtab(view: 'habits' | 'goals' | 'agenda'): void {
    showAppSection('habitos');
    showView(view);
    closeHabitosDropdown();
  }
  quickAgenda.addEventListener('click', () => goToSubtab('agenda'));
  quickHabits.addEventListener('click', () => goToSubtab('habits'));
  quickGoals.addEventListener('click', () => goToSubtab('goals'));

  // En mouse, el hover ya despliega el submenú (CSS) y el clic navega
  // directo a la última subpestaña vista, como antes. En pantallas táctiles
  // no existe hover real: el primer toque solo despliega el submenú.
  navHabitos.addEventListener('click', (e) => {
    if (window.matchMedia('(hover: hover)').matches) {
      showAppSection('habitos');
      return;
    }
    e.preventDefault();
    navHabitosWrap.classList.toggle('app-nav__item-wrap--open');
  });
  navHabitosWrap.addEventListener('focusout', (e) => {
    if (!navHabitosWrap.contains(e.relatedTarget as Node)) closeHabitosDropdown();
  });
  navHabitosWrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHabitosDropdown();
      navHabitos.focus();
    }
  });

  const appNav = el('nav', { class: 'app-nav' }, [navHabitosWrap, navFitplan]);

  const SECTION_HERO = {
    habitos: {
      kicker: 'Agenda · Hábitos · Metas & Coach',
      desc: 'Construye hábitos que se mantienen: organiza tu agenda, cumple tus metas y cuenta con un coach de IA que te acompaña en el camino.',
    },
    fitplan: {
      kicker: 'FitPlan · Entrenamiento & Nutrición',
      desc: 'Ingresa tus datos y obtén un plan personalizado de entrenamiento y nutrición generado por inteligencia artificial.',
    },
  } as const;

  const fitplanSection = el('div', { class: 'fitplan-section', style: 'display:none' });
  let fitplanLoaded = false;

  function showAppSection(section: 'habitos' | 'fitplan'): void {
    main.style.display = section === 'habitos' ? '' : 'none';
    fitplanSection.style.display = section === 'fitplan' ? '' : 'none';
    navHabitos.classList.toggle('app-nav__item--active', section === 'habitos');
    navFitplan.classList.toggle('app-nav__item--active', section === 'fitplan');
    heroKicker.textContent = SECTION_HERO[section].kicker;
    heroDesc.textContent = SECTION_HERO[section].desc;
    if (section === 'fitplan' && !fitplanLoaded) {
      fitplanLoaded = true;
      renderFitPlan(fitplanSection);
    }
  }
  navFitplan.addEventListener('click', () => {
    closeHabitosDropdown();
    showAppSection('fitplan');
  });

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
  const weekNav = createWeekNav({
    addLabel: 'Hábito',
    prevLabel: 'Semana anterior',
    nextLabel: 'Semana siguiente',
    onPrev: () => {
      currentMonday = addWeeks(currentMonday, -1);
      void loadWeek();
    },
    onNext: () => {
      currentMonday = addWeeks(currentMonday, 1);
      void loadWeek();
    },
    onToday: () => {
      currentMonday = startOfWeek(new Date());
      void loadWeek();
    },
    onAdd: () => void onAddHabit(),
  });
  const rangeLabel = weekNav.rangeLabel;

  const tableWrap = el('div', { class: 'table-wrap' });
  const weekSection = el('section', { class: 'week' }, [weekNav.element, tableWrap]);

  // ---- Pestañas: Agenda / Hábitos / Metas ----
  // Las tres arrancan ocultas/sin cargar por igual; showView('agenda') más
  // abajo decide cuál se ve primero y dispara su carga de datos.
  const habitsView = el('div', { class: 'view', style: 'display:none' }, [
    createQuoteCard(),
    overview,
    weekSection,
    statsGrid,
  ]);
  const goalsView = el('div', { class: 'view', style: 'display:none' });
  const agendaView = el('div', { class: 'view', style: 'display:none' });

  // La navegación entre estas 3 vistas vive solo en el submenú de "Hábitos"
  // (ver navHabitosWrap más arriba); aquí solo queda un título fijo que dice
  // en cuál estás.
  const VIEW_TITLES: Record<'habits' | 'goals' | 'agenda', string> = {
    agenda: 'Agenda',
    habits: 'Hábitos',
    goals: 'Metas',
  };
  const subsectionTitle = el('h2', { class: 'subsection-title' }, ['Agenda']);

  let habitsLoaded = false;
  let goalsLoaded = false;
  let agendaLoaded = false;
  function showView(view: 'habits' | 'goals' | 'agenda'): void {
    habitsView.style.display = view === 'habits' ? '' : 'none';
    goalsView.style.display = view === 'goals' ? '' : 'none';
    agendaView.style.display = view === 'agenda' ? '' : 'none';
    subsectionTitle.textContent = VIEW_TITLES[view];
    quickHabits.classList.toggle('app-nav__dropdown-item--active', view === 'habits');
    quickGoals.classList.toggle('app-nav__dropdown-item--active', view === 'goals');
    quickAgenda.classList.toggle('app-nav__dropdown-item--active', view === 'agenda');
    if (view === 'habits' && !habitsLoaded) {
      habitsLoaded = true;
      void loadWeek();
    }
    if (view === 'goals' && !goalsLoaded) {
      goalsLoaded = true;
      void renderGoalsBoard(goalsView, userId);
    }
    if (view === 'agenda' && !agendaLoaded) {
      agendaLoaded = true;
      void renderAgendaView(agendaView, userId);
    }
  }

  const main = el('main', { class: 'dashboard' }, [subsectionTitle, habitsView, goalsView, agendaView]);
  const appEl = el('div', { class: 'app' }, [topbar, appNav, headerHero, main, fitplanSection]);
  root.append(appEl);
  mountCoachWidget();

  // Los canvas ya están en el DOM: ahora sí se pueden crear las gráficas.
  const dailyChart = new DailyChart(dailyCanvas);
  const weeklyChart = new WeeklyChart(weeklyCanvas);

  // ---- Carga inicial: se abre en Agenda por defecto ----
  showView('agenda');

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
    const yesterdayISO = toISODate(addDays(new Date(), -1));

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

      renderTable(days, todayISO, yesterdayISO);
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
  function renderTable(days: Date[], todayISO: string, yesterdayISO: string): void {
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
        // Solo se puede marcar/desmarcar hoy o ayer: evita reescribir
        // racha/historial de días más viejos (o del futuro) por error.
        const isEditable = dateISO === todayISO || dateISO === yesterdayISO;

        const box = el('button', {
          class: 'check' + (done ? ' check--on' : '') + (isToday ? ' check--today' : ''),
          role: 'checkbox',
          'aria-checked': String(done),
          'aria-label': `${DAY_NAMES[i]} ${d.getDate()}, ${habit.name}`,
          type: 'button',
          disabled: !isEditable,
        }, [icons.check()]);
        box.style.setProperty('--habit', habit.color);
        if (isEditable) box.addEventListener('click', () => void onToggle(habit, dateISO, box));

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
      const { editBtn, delBtn } = createEditDeleteButtons(
        habit.name,
        () => void onEditHabit(habit),
        () => void onDeleteHabit(habit),
      );
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
      const monthStartISO = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));

      for (const log of logs) {
        if (!log.completed) continue;
        activeDays.add(log.log_date);
        doneCountByDay.set(log.log_date, (doneCountByDay.get(log.log_date) ?? 0) + 1);
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
      renderHabitStats(computeHabitCompletionPct(habits, logs, today));
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
  function renderHabitStats(pctByHabit: Map<string, number>): void {
    clear(habitStatsList);
    if (habits.length === 0) {
      habitStatsList.append(el('p', { class: 'state__text' }, ['Agrega hábitos para ver tus estadísticas.']));
      return;
    }
    for (const habit of habits) {
      const pct = pctByHabit.get(habit.id) ?? 0;

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
  /** Repinta la tabla de la semana visible y las gráficas tras un cambio en la lista de hábitos. */
  function refreshTableAndCharts(): void {
    const days = weekDays(currentMonday);
    const todayISO = toISODate(new Date());
    renderTable(days, todayISO, toISODate(addDays(new Date(), -1)));
    recomputeCharts(days, todayISO);
  }

  async function onAddHabit(): Promise<void> {
    const result = await openHabitForm();
    if (!result) return;
    try {
      const position = habits.length;
      const created = await createHabit(userId, result.name, result.color, position);
      habits.push(created);
      refreshTableAndCharts();
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
      await updateHabit(habit.id, userId, { name: result.name, color: result.color });
      habit.name = result.name;
      habit.color = result.color;
      refreshTableAndCharts();
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
      await deleteHabit(habit.id, userId);
      habits = habits.filter((h) => h.id !== habit.id);
      refreshTableAndCharts();
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
