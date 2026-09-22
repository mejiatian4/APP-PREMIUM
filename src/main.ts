import './styles/main.css';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { renderAuthScreen, signOut } from './auth/auth';
import { renderResetPasswordScreen } from './auth/resetPassword';
import { renderDashboard } from './habits/dashboard';
import { renderAccessGate } from './access/gate';
import { getMyAccessCode } from './access/api';
import { startInactivityWatch } from './lib/inactivity';
import { consumeIntentionalSignIn } from './lib/authIntent';
import { qs } from './ui/dom';
import { toast } from './ui/toast';
import { initHeaderAutoHide } from './ui/scrollHeader';
import { initShopCarousel } from './ui/shopCarousel';

const app = qs<HTMLElement>('#app');

initHeaderAutoHide();
initShopCarousel();

// El enlace de "recuperar contraseña" trae `type=recovery` en el hash de la
// URL, y el de "confirma tu correo" trae `type=signup`. Los capturamos ya
// mismo (síncrono, antes de que Supabase lo procese y lo limpie) porque en
// una carga de página nueva —justo lo que pasa al abrir el enlace del
// correo— Supabase suele emitir INITIAL_SESSION en vez de PASSWORD_RECOVERY
// o SIGNED_IN, así que no podemos fiarnos solo del nombre del evento.
const urlIsPasswordRecovery = /type=recovery/.test(window.location.hash);
const urlIsSignupConfirmation = /type=signup/.test(window.location.hash);

// Al abrir el enlace de "recuperar contraseña", Supabase deja al usuario con
// una sesión iniciada (así puede llamar a `updateUser` para poner la nueva).
// Esa sesión se persiste en localStorage igual que cualquier otra: si la
// persona recarga la pantalla de "nueva contraseña" o la cierra sin
// terminarla, al volver a entrar la app la restauraría como un login válido
// SIN que nunca haya puesto la contraseña nueva. Guardamos aquí de quién es
// la recuperación pendiente para poder rechazar esa sesión huérfana en vez
// de dejarla pasar. Solo se limpia cuando la persona termina el formulario
// (`renderResetPasswordScreen` -> onSuccess) o cuando inicia sesión de
// verdad con su contraseña real (evento SIGNED_IN, no restaurado).
const PENDING_RECOVERY_KEY = 'kroton_pending_recovery_uid';

function markRecoveryPending(uid: string): void {
  try {
    localStorage.setItem(PENDING_RECOVERY_KEY, uid);
  } catch {
    // Almacenamiento no disponible (modo privado estricto, etc.): no podemos
    // proteger este caso, pero tampoco empeora nada respecto a antes.
  }
}
function clearRecoveryPending(): void {
  try {
    localStorage.removeItem(PENDING_RECOVERY_KEY);
  } catch {
    // noop
  }
}
function isRecoveryPendingFor(uid: string): boolean {
  try {
    return localStorage.getItem(PENDING_RECOVERY_KEY) === uid;
  } catch {
    return false;
  }
}

type View = 'auth' | 'gate' | 'dashboard' | 'reset-password';
let view: View | null = null;
let userId: string | null = null;
let recoveryHandled = false;
let signupConfirmationHandled = false;

async function goPastAuth(session: Session, isRestoredSession: boolean): Promise<void> {
  const stillActive = startInactivityWatch(
    () => void signOut('Tu sesión se cerró por inactividad.'),
    isRestoredSession,
  );
  if (!stillActive) return; // sesión vencida por inactividad: el signOut ya quedó disparado.

  let hasCode: string | null = null;
  try {
    hasCode = await getMyAccessCode();
  } catch {
    // Si falla la consulta, mostramos la puerta igual: más seguro pedir
    // el código de nuevo que dejar pasar al tablero sin haberlo verificado.
  }
  if (userId !== session.user.id) return; // la sesión cambió mientras esperábamos

  if (hasCode) {
    view = 'dashboard';
    renderDashboard(app, session.user.id, session.user.email ?? '');
  } else {
    view = 'gate';
    renderAccessGate(app, () => {
      view = 'dashboard';
      renderDashboard(app, session.user.id, session.user.email ?? '');
    });
  }
}

async function applySession(event: AuthChangeEvent, session: Session | null): Promise<void> {
  // Mientras el usuario está poniendo su nueva contraseña, ignoramos otros
  // eventos de sesión de fondo para no sacarlo de esa pantalla a mitad de camino.
  if (view === 'reset-password') return;

  const isRecovery = !recoveryHandled && !!session && (event === 'PASSWORD_RECOVERY' || urlIsPasswordRecovery);
  if (isRecovery && session) {
    recoveryHandled = true;
    markRecoveryPending(session.user.id);
    // Limpiamos el hash para que un refresh no vuelva a caer aquí.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    view = 'reset-password';
    userId = session.user.id;
    renderResetPasswordScreen(app, () => {
      clearRecoveryPending();
      view = null; // fuerza reevaluar desde cero con la sesión ya actualizada.
      void goPastAuth(session, false); // la persona acaba de actuar: no es una sesión restaurada.
    });
    return;
  }

  const isSignupConfirmation = !signupConfirmationHandled && !!session && urlIsSignupConfirmation;
  if (isSignupConfirmation && session) {
    signupConfirmationHandled = true;
    // Limpiamos el hash para que un refresh no vuelva a caer aquí.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    // Supabase deja al usuario con sesión iniciada tras confirmar el correo,
    // pero preferimos que entre a propósito con su contraseña en vez de
    // dejarlo "colado" directo al tablero sin haber hecho nada.
    await supabase.auth.signOut();
    view = 'auth';
    userId = null;
    renderAuthScreen(app);
    toast('Se ha confirmado tu correo. Por favor inicia sesión.', 'success', 6000);
    return;
  }

  if (session) {
    // OJO: el nombre del evento NO alcanza para saber si esta sesión es una
    // restauración silenciosa o un login real. Restaurar desde
    // almacenamiento una sesión que sigue siendo válida (no necesita
    // refrescar el token) también notifica como `SIGNED_IN` —igual que un
    // login real—, no como `INITIAL_SESSION`/`TOKEN_REFRESHED`. Por eso
    // usamos nuestra propia marca (ver lib/authIntent.ts), puesta a mano justo
    // antes de llamar a signInWithPassword/signUp, en vez de confiar en `event`.
    const isRestoredSession = !consumeIntentionalSignIn();

    // Una sesión de recuperación restaurada (nunca se llegó a poner la
    // contraseña nueva) NO cuenta como login válido: se rechaza y se manda a
    // la pantalla de acceso normal. Si en cambio la persona sí acaba de
    // iniciar sesión de verdad, ya demostró su contraseña real, así que
    // limpiamos cualquier marca vieja y la dejamos entrar.
    if (isRestoredSession && isRecoveryPendingFor(session.user.id)) {
      await supabase.auth.signOut();
      view = 'auth';
      userId = null;
      renderAuthScreen(app);
      toast(
        'El enlace de recuperación quedó incompleto. Inicia sesión de nuevo o pide uno nuevo si necesitas restablecer tu contraseña.',
        'error',
        7000,
      );
      return;
    }
    if (!isRestoredSession) clearRecoveryPending();

    // Re-evaluamos solo si cambia el usuario o veníamos de la pantalla de auth;
    // así un TOKEN_REFRESHED de fondo no reinicia el tablero ni la puerta de acceso.
    if (userId === session.user.id && view !== 'auth') return;
    userId = session.user.id;
    await goPastAuth(session, isRestoredSession);
  } else if (view !== 'auth') {
    view = 'auth';
    userId = null;
    renderAuthScreen(app);
  }
}

// onAuthStateChange emite INITIAL_SESSION al suscribirse, así que cubre tanto
// la carga inicial como los cambios (login / logout). Diferimos con setTimeout
// para no llamar a Supabase dentro del propio callback (evita bloqueos).
supabase.auth.onAuthStateChange((event, session) => {
  setTimeout(() => void applySession(event, session), 0);
});
