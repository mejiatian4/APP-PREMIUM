// CAPTCHA del registro (Cloudflare Turnstile). El script externo se carga
// desde index.html con `render=explicit`, así que nosotros decidimos cuándo
// y dónde pintar el widget en vez de que se monte solo.

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
      }): string;
      reset(widgetId: string): void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

let turnstileReady: Promise<void> | null = null;

/** Se resuelve cuando `window.turnstile` ya existe (el script externo cargó). */
function waitForTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!turnstileReady) {
    turnstileReady = new Promise((resolve) => {
      window.onTurnstileLoad = resolve;
    });
  }
  return turnstileReady;
}

export interface TurnstileWidget {
  /** Token vigente, o null si todavía no se completó el reto (o ya se gastó). */
  getToken(): string | null;
  /** Pide un token nuevo: hay que llamarlo tras cada intento de registro, éxito o no. */
  reset(): void;
}

/**
 * Monta el widget dentro de `container`. Si no hay `VITE_TURNSTILE_SITE_KEY`
 * configurada, no hace nada y devuelve null — el registro sigue funcionando
 * sin CAPTCHA (la protección real, si Supabase la tiene activada del lado
 * del servidor, rechaza igual la petición sin un token válido).
 */
export async function mountTurnstile(container: HTMLElement): Promise<TurnstileWidget | null> {
  if (!SITE_KEY) return null;
  await waitForTurnstile();

  let token: string | null = null;
  const widgetId = window.turnstile!.render(container, {
    sitekey: SITE_KEY,
    callback: (t) => {
      token = t;
    },
    'error-callback': () => {
      token = null;
    },
    'expired-callback': () => {
      token = null;
    },
  });

  return {
    getToken: () => token,
    reset: () => {
      token = null;
      window.turnstile!.reset(widgetId);
    },
  };
}
