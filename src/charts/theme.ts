/** Lee una variable CSS del :root para que las gráficas sigan el tema. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
