import { el } from './dom';

// Notificaciones efímeras en la esquina inferior. Sirven para confirmar
// acciones y, sobre todo, para comunicar errores con un mensaje claro.

let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container) {
    container = el('div', { class: 'toast-stack', 'aria-live': 'polite', role: 'status' });
    document.body.append(container);
  }
  return container;
}

/** `durationMs` deja fijar cuánto dura en pantalla; si no se pasa, usa el default por tipo. */
export function toast(message: string, kind: 'success' | 'error' = 'success', durationMs?: number): void {
  const node = el('div', { class: `toast toast--${kind}` }, [message]);
  getContainer().append(node);

  // Forzar reflow para que la transición de entrada se aplique.
  requestAnimationFrame(() => node.classList.add('toast--visible'));

  const ttl = durationMs ?? (kind === 'error' ? 5000 : 2600);
  window.setTimeout(() => {
    node.classList.remove('toast--visible');
    node.addEventListener('transitionend', () => node.remove(), { once: true });
  }, ttl);
}

/** Extrae un mensaje legible de un error desconocido. */
export function errorMessage(err: unknown, fallback = 'Algo salió mal. Intenta de nuevo.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string') return err;
  // Los errores de Supabase (PostgrestError, incluidas las excepciones de
  // funciones RPC) son objetos planos con `.message`, no instancias de Error.
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' && err.message) {
    return err.message;
  }
  return fallback;
}
