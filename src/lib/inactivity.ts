const COOKIE_NAME = 'kroton_last_activity';
const MAX_INACTIVITY_MS = 5 * 60 * 60 * 1000; // 5 horas
const WRITE_THROTTLE_MS = 60 * 1000; // no reescribir la cookie más de 1 vez por minuto
const CHECK_INTERVAL_MS = 60 * 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

function touchCookie(): void {
  const maxAgeSeconds = Math.floor(MAX_INACTIVITY_MS / 1000);
  document.cookie = `${COOKIE_NAME}=1; max-age=${maxAgeSeconds}; path=/; samesite=lax`;
}

// Nos apoyamos en el propio vencimiento (`max-age`) de la cookie: si sigue
// existiendo, hubo actividad hace menos de 5 horas. Así no hace falta guardar
// ni parsear un timestamp a mano.
function hasFreshCookie(): boolean {
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE_NAME}=`));
}

let intervalId = 0;
let lastWrite = 0;
let onTimeoutCb: (() => void) | null = null;

function handleActivity(): void {
  const now = Date.now();
  if (now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;
  touchCookie();
}

function checkExpired(): void {
  if (hasFreshCookie()) return;
  const cb = onTimeoutCb;
  stopInactivityWatch();
  cb?.();
}

function onVisibilityChange(): void {
  // Al volver a la pestaña (p. ej. reabrirla horas después) revisamos de
  // inmediato, en vez de esperar al siguiente tick del setInterval.
  if (document.visibilityState === 'visible') checkExpired();
}

/**
 * Vigila la inactividad del usuario mientras hay una sesión abierta: si
 * pasan 5 horas sin ninguna interacción, llama a `onTimeout` (para cerrar la
 * sesión). Depende de una cookie propia y no de la sesión de Supabase, que
 * se auto-refresca sola en segundo plano y nunca "expiraría" por inactividad
 * si dependiéramos de ella.
 *
 * `isRestoredSession` debe ser `true` cuando la sesión ya existía antes de
 * esta carga de página (p. ej. `INITIAL_SESSION` al reabrir la pestaña) y
 * `false` cuando es un inicio de sesión recién hecho por la persona. Si es
 * una sesión restaurada y la cookie ya venció, cerramos la sesión de una vez
 * en vez de renovarla: de lo contrario, cada recarga "resucitaría" el
 * contador y la sesión nunca expiraría por más tiempo que pasara con el
 * navegador cerrado.
 *
 * Devuelve `false` cuando la sesión ya estaba vencida (y por lo tanto llamó
 * a `onTimeout` sin activar la vigilancia); el llamador debe cortar ahí en
 * vez de seguir mostrando contenido protegido mientras el cierre de sesión
 * termina en segundo plano.
 */
export function startInactivityWatch(onTimeout: () => void, isRestoredSession: boolean): boolean {
  if (intervalId) return true; // ya está vigilando
  if (isRestoredSession && !hasFreshCookie()) {
    onTimeout();
    return false;
  }
  onTimeoutCb = onTimeout;
  lastWrite = Date.now();
  touchCookie();

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, handleActivity, { passive: true });
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  intervalId = window.setInterval(checkExpired, CHECK_INTERVAL_MS);
  return true;
}

/** Detiene la vigilancia y limpia los listeners; se llama al cerrar sesión por cualquier motivo. */
export function stopInactivityWatch(): void {
  if (!intervalId) return;
  window.clearInterval(intervalId);
  intervalId = 0;
  onTimeoutCb = null;
  for (const evt of ACTIVITY_EVENTS) {
    window.removeEventListener(evt, handleActivity);
  }
  document.removeEventListener('visibilitychange', onVisibilityChange);
}
