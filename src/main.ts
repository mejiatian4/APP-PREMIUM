import './styles/main.css';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { renderAuthScreen } from './auth/auth';
import { renderDashboard } from './habits/dashboard';
import { qs } from './ui/dom';
import { initHeaderAutoHide } from './ui/scrollHeader';

const app = qs<HTMLElement>('#app');

initHeaderAutoHide();

let view: 'auth' | 'dashboard' | null = null;
let userId: string | null = null;

function applySession(session: Session | null): void {
  if (session) {
    // Re-renderizamos solo si cambia el usuario o veníamos de la pantalla de auth.
    if (view !== 'dashboard' || userId !== session.user.id) {
      view = 'dashboard';
      userId = session.user.id;
      renderDashboard(app, session.user.id, session.user.email ?? '');
    }
  } else if (view !== 'auth') {
    view = 'auth';
    userId = null;
    renderAuthScreen(app);
  }
}

// onAuthStateChange emite INITIAL_SESSION al suscribirse, así que cubre tanto
// la carga inicial como los cambios (login / logout). Diferimos con setTimeout
// para no llamar a Supabase dentro del propio callback (evita bloqueos).
supabase.auth.onAuthStateChange((_event, session) => {
  setTimeout(() => applySession(session), 0);
});
