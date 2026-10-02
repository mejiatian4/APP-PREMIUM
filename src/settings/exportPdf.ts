import { formatShortDate, formatTime12h, toISODate, addDays } from '../lib/dates';
import { listHabits, getLogsForRange } from '../habits/api';
import { computeHabitCompletionPct } from '../habits/stats';
import { listAgendaItems } from '../agenda/api';
import { describeRecurrence } from '../agenda/occurrences';
import { listGoals } from '../goals/api';
import { TERMS, TERM_LABELS } from '../goals/constants';

function formatDate(iso: string | null): string {
  return iso ? formatShortDate(iso) : '—';
}

/** '#rrggbb' -> [r, g, b] para `doc.setFillColor`. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Trae el logo público y lo convierte a data URL para incrustarlo en el PDF. */
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}logo-kroton-naranja.png`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // Si falla, el PDF se genera igual, solo sin el logo.
  }
}

/**
 * Genera y descarga un PDF con un resumen completo: Agenda, Hábitos y Metas
 * (agrupadas por plazo). jsPDF se importa de forma diferida: solo se
 * descarga cuando el usuario realmente pide el reporte.
 */
export async function downloadFullReportPdf(userEmail: string): Promise<void> {
  const today = new Date();
  const todayISO = toISODate(today);
  const last30StartISO = toISODate(addDays(today, -29));

  const [{ jsPDF }, logoDataUrl, habits, agendaItems, goals, last30Logs] = await Promise.all([
    import('jspdf'),
    loadLogoDataUrl(),
    listHabits(),
    listAgendaItems(),
    listGoals(),
    getLogsForRange(last30StartISO, todayISO),
  ]);
  const habitPct = computeHabitCompletionPct(habits, last30Logs, today);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const bottomLimit = pageHeight - 56;
  const logoSize = 36;
  const textX = logoDataUrl ? marginX + logoSize + 12 : marginX;

  function drawHeader(): void {
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageWidth, 90, 'F');
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'JPEG', marginX, 22, logoSize, logoSize);
    }
    doc.setTextColor(252, 184, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('KROTON HABITOS', textX, 40);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Reporte completo · Agenda, Hábitos y Metas', textX, 60);
    doc.setFontSize(9);
    const generatedAt = today.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`${userEmail} · generado el ${generatedAt}`, textX, 76);
  }

  function addPage(): number {
    doc.addPage();
    drawHeader();
    return 120;
  }

  /** Si no caben `needed` puntos antes del margen inferior, abre página nueva. */
  function ensureSpace(y: number, needed: number): number {
    return y > bottomLimit - needed ? addPage() : y;
  }

  function sectionTitle(y: number, title: string): number {
    y = ensureSpace(y, 44);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(150, 110, 10);
    doc.text(title, marginX, y);
    y += 8;
    doc.setDrawColor(252, 184, 39);
    doc.setLineWidth(1.4);
    doc.line(marginX, y, pageWidth - marginX, y);
    return y + 24;
  }

  function emptyNote(y: number, text: string): number {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(110, 110, 110);
    doc.text(text, marginX, y);
    return y + 26;
  }

  drawHeader();
  let y = 120;
  doc.setTextColor(20, 20, 20);

  // ---- Sección: Agenda ----
  y = sectionTitle(y, 'AGENDA');
  if (agendaItems.length === 0) {
    y = emptyNote(y, 'No tienes pendientes agendados.');
  } else {
    const sorted = [...agendaItems].sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
    for (const item of sorted) {
      y = ensureSpace(y, 36);
      const [r, g, b] = hexToRgb(item.color);
      doc.setFillColor(r, g, b);
      doc.circle(marginX + 3, y - 4, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(20, 20, 20);
      doc.text(`${formatTime12h(item.time_of_day)}  ·  ${item.title}`, marginX + 14, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      const detail = item.note ? `${describeRecurrence(item)} · ${item.note}` : describeRecurrence(item);
      y = ensureSpace(y, 14);
      doc.text(detail, marginX + 14, y);
      y += 20;
    }
  }
  y += 6;

  // ---- Sección: Hábitos ----
  y = sectionTitle(y, 'HÁBITOS');
  if (habits.length === 0) {
    y = emptyNote(y, 'Todavía no tienes hábitos registrados.');
  } else {
    for (const habit of habits) {
      y = ensureSpace(y, 36);
      const [r, g, b] = hexToRgb(habit.color);
      doc.setFillColor(r, g, b);
      doc.circle(marginX + 3, y - 4, 3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(20, 20, 20);
      doc.text(habit.name, marginX + 14, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      const pct = habitPct.get(habit.id) ?? 0;
      const createdISO = toISODate(new Date(habit.created_at));
      doc.text(`Desde el ${formatDate(createdISO)} · ${pct}% de cumplimiento (últimos 30 días)`, marginX + 14, y);
      y += 20;
    }
  }
  y += 6;

  // ---- Sección: Metas ----
  y = sectionTitle(y, 'METAS');
  if (goals.length === 0) {
    y = emptyNote(y, 'Todavía no has creado ninguna meta.');
  }
  for (const term of TERMS) {
    const termGoals = goals.filter((g) => g.term === term);
    if (termGoals.length === 0) continue;

    y = ensureSpace(y, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(150, 110, 10);
    doc.text(TERM_LABELS[term].toUpperCase(), marginX, y);
    y += 18;

    for (const goal of termGoals) {
      y = ensureSpace(y, 40);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(20, 20, 20);
      const status = goal.completed ? '[Cumplida]  ' : '[Pendiente]  ';
      doc.text(`${status}${goal.title}`, marginX, y);
      y += 14;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 110, 110);
      doc.text(`Del ${formatDate(goal.start_date)} al ${formatDate(goal.end_date)}`, marginX, y);
      y += 13;

      if (goal.description) {
        y = ensureSpace(y, 20);
        doc.setFontSize(9);
        const lines: string[] = doc.splitTextToSize(goal.description, pageWidth - marginX * 2);
        doc.text(lines, marginX, y);
        y += lines.length * 11 + 4;
      }
      y += 10;
    }
    y += 8;
  }

  doc.save('kroton-habitos-reporte.pdf');
}
