import Chart from 'chart.js/auto';
import { DAY_LABELS } from '../lib/dates';
import { cssVar } from './theme';

export class WeeklyChart {
  private chart: Chart;

  constructor(canvas: HTMLCanvasElement) {
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [...DAY_LABELS],
        datasets: [
          {
            data: [0, 0, 0, 0, 0, 0, 0],
            backgroundColor: cssVar('--accent-soft'),
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 38,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 25,
              color: cssVar('--text-muted'),
              font: { family: 'Inter', size: 11 },
              callback: (v) => `${v}%`,
            },
            grid: { color: cssVar('--border') },
            border: { display: false },
          },
          x: {
            ticks: { color: cssVar('--text-muted'), font: { family: 'Inter', size: 12 } },
            grid: { display: false },
            border: { display: false },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${Math.round(ctx.parsed.y ?? 0)}% completado`,
            },
          },
        },
      },
    });
  }

  /**
   * @param percentages  Array de 7 porcentajes (lunes..domingo).
   * @param todayIndex   Índice del día de hoy dentro de la semana (-1 si no aplica).
   */
  update(percentages: number[], todayIndex: number): void {
    const accent = cssVar('--accent');
    const soft = cssVar('--accent-soft');
    this.chart.data.datasets[0].data = percentages;
    // Resaltar la barra de hoy con el color de acento pleno.
    this.chart.data.datasets[0].backgroundColor = percentages.map((_, i) =>
      i === todayIndex ? accent : soft,
    );
    this.chart.update();
  }
}
