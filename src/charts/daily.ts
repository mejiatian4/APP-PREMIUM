import Chart from 'chart.js/auto';
import { cssVar } from './theme';

// Plugin que dibuja el conteo y el porcentaje en el centro de la dona.
const centerText = {
  id: 'centerText',
  afterDraw(chart: Chart) {
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.[
      'centerText'
    ] as { line1?: string; line2?: string } | undefined;
    if (!opts) return;

    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = cssVar('--text');
    ctx.font = `700 30px "Space Mono", ui-monospace, monospace`;
    ctx.fillText(opts.line1 ?? '', cx, cy - 8);

    ctx.fillStyle = cssVar('--text-muted');
    ctx.font = `600 12px "Inter", system-ui, sans-serif`;
    ctx.fillText(opts.line2 ?? '', cx, cy + 16);
    ctx.restore();
  },
};

export class DailyChart {
  private chart: Chart;

  constructor(canvas: HTMLCanvasElement) {
    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Completados', 'Pendientes'],
        datasets: [
          {
            data: [0, 1],
            backgroundColor: [cssVar('--accent'), cssVar('--track')],
            borderWidth: 0,
            // @ts-expect-error: propiedad válida en runtime de Chart.js
            cutout: '74%',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          // @ts-expect-error: opciones del plugin personalizado
          centerText: { line1: '0/0', line2: 'del día' },
        },
      },
      plugins: [centerText],
    });
  }

  update(done: number, total: number): void {
    const pending = Math.max(total - done, 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    this.chart.data.datasets[0].data = total > 0 ? [done, pending] : [0, 1];
    this.chart.data.datasets[0].backgroundColor = [cssVar('--accent'), cssVar('--track')];

    const plugins = this.chart.options.plugins as Record<string, { line1: string; line2: string }>;
    plugins['centerText'] = {
      line1: total > 0 ? `${done}/${total}` : '—',
      line2: total > 0 ? `${pct}% del día` : 'sin hábitos',
    };
    this.chart.update();
  }
}
