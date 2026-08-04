import './styles/main.css';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { renderAuthScreen } from './auth/auth';
import { renderResetPasswordScreen } from './auth/resetPassword';
import { renderDashboard } from './habits/dashboard';
import { renderAccessGate } from './access/gate';
import { getMyAccessCode } from './access/api';
import { qs } from './ui/dom';
import { initHeaderAutoHide } from './ui/scrollHeader';
import { initShopCarousel } from './ui/shopCarousel';

const app = qs<HTMLElement>('#app');

initHeaderAutoHide();
initShopCarousel();

// El enlace de "recuperar contraseña" trae `type=recovery` en el hash de la
// URL. Lo capturamos ya mismo (síncrono, antes de que Supabase lo procese y
// lo limpie) porque en una carga de página nueva —justo lo que pasa al abrir
// el enlace del correo— Supabase suele emitir INITIAL_SESSION en vez de
// PASSWORD_RECOVERY, así que no podemos fiarnos solo del nombre del evento.
const urlIsPasswordRecovery = /type=recovery/.test(window.location.hash);

type View = 'auth' | 'gate' | 'dashboard' | 'reset-password';
let view: View | null = null;
let userId: string | null = null;
let recoveryHandled = false;

async function goPastAuth(session: Session): Promise<void> {
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
    // Limpiamos el hash para que un refresh no vuelva a caer aquí.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    view = 'reset-password';
    userId = session.user.id;
    renderResetPasswordScreen(app, () => {
      view = null; // fuerza reevaluar desde cero con la sesión ya actualizada.
      void goPastAuth(session);
    });
    return;
  }

  if (session) {
    // Re-evaluamos solo si cambia el usuario o veníamos de la pantalla de auth;
    // así un TOKEN_REFRESHED de fondo no reinicia el tablero ni la puerta de acceso.
    if (userId === session.user.id && view !== 'auth') return;
    userId = session.user.id;
    await goPastAuth(session);
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
