import type { Goal, GoalTerm } from '../lib/types';

const TERMS: GoalTerm[] = ['short', 'medium', 'long'];
const TERM_LABELS: Record<GoalTerm, string> = {
  short: 'Corto plazo',
  medium: 'Mediano plazo',
  long: 'Largo plazo',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace('.', '');
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
 * Genera y descarga un PDF con todas las metas del usuario, agrupadas por
 * plazo. jsPDF se importa de forma diferida: solo se descarga cuando el
 * usuario realmente pide el PDF, para no engordar el paquete inicial.
 */
export async function downloadGoalsPdf(goals: Goal[], userEmail: string): Promise<void> {
  const [{ jsPDF }, logoDataUrl] = await Promise.all([import('jspdf'), loadLogoDataUrl()]);
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
    doc.text('Reporte de metas', textX, 60);
    doc.setFontSize(9);
    const generatedAt = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`${userEmail} · generado el ${generatedAt}`, textX, 76);
  }

  function addPage(): number {
    doc.addPage();
    drawHeader();
    return 120;
  }

  drawHeader();
  let y = 120;
  doc.setTextColor(20, 20, 20);

  if (goals.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text('Todavía no has creado ninguna meta.', marginX, y);
  }

  for (const term of TERMS) {
    const termGoals = goals.filter((g) => g.term === term);
    if (termGoals.length === 0) continue;

    if (y > bottomLimit - 40) y = addPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(150, 110, 10);
    doc.text(TERM_LABELS[term].toUpperCase(), marginX, y);
    y += 6;
    doc.setDrawColor(252, 184, 39);
    doc.setLineWidth(1);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 22;

    for (const goal of termGoals) {
      if (y > bottomLimit - 40) y = addPage();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(20, 20, 20);
      const status = goal.completed ? '[Cumplida]  ' : '[Pendiente]  ';
      doc.text(`${status}${goal.title}`, marginX, y);
      y += 15;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(110, 110, 110);
      doc.text(`Del ${formatDate(goal.start_date)} al ${formatDate(goal.end_date)}`, marginX, y);
      y += 14;

      if (goal.description) {
        if (y > bottomLimit - 20) y = addPage();
        doc.setFontSize(9.5);
        const lines: string[] = doc.splitTextToSize(goal.description, pageWidth - marginX * 2);
        doc.text(lines, marginX, y);
        y += lines.length * 12 + 6;
      }
      y += 12;
    }
    y += 10;
  }

  doc.save('kroton-habitos-metas.pdf');
}