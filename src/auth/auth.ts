import { supabase } from '../lib/supabase';
import { el, clear } from '../ui/dom';
import { toast, errorMessage } from '../ui/toast';

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Renderiza la pantalla de autenticación (iniciar sesión / crear cuenta)
 * dentro del contenedor dado. El cambio de sesión lo escucha main.ts,
 * así que aquí solo disparamos las llamadas a Supabase.
 */
export function renderAuthScreen(root: HTMLElement): void {
  clear(root);

  let mode: 'signin' | 'signup' = 'signin';

  const title = el('h1', { class: 'auth__title' });
  const subtitle = el('p', { class: 'auth__subtitle' });

  const email = el('input', {
    type: 'email',
    class: 'field__input',
    id: 'email',
    placeholder: 'tucorreo@ejemplo.com',
    autocomplete: 'email',
    required: true,
  });

  const password = el('input', {
    type: 'password',
    class: 'field__input',
    id: 'password',
    placeholder: 'Mínimo 6 caracteres',
    autocomplete: 'current-password',
    required: true,
    minLength: 6,
  });

  const submit = el('button', { type: 'submit', class: 'btn btn--primary btn--block' });
  const toggle = el('button', { type: 'button', class: 'auth__toggle' });
  const switchText = el('span', { class: 'auth__switch-text' });

  function paint(): void {
    if (mode === 'signin') {
      title.textContent = 'Bienvenido de vuelta';
      subtitle.textContent = 'Entra para seguir construyendo tus hábitos.';
      submit.textContent = 'Iniciar sesión';
      switchText.textContent = '¿Aún no tienes cuenta?';
      toggle.textContent = 'Crear una';
      password.setAttribute('autocomplete', 'current-password');
    } else {
      title.textContent = 'Crea tu cuenta';
      subtitle.textContent = 'Empieza a registrar tus hábitos hoy mismo.';
      submit.textContent = 'Crear cuenta';
      switchText.textContent = '¿Ya tienes cuenta?';
      toggle.textContent = 'Inicia sesión';
      password.setAttribute('autocomplete', 'new-password');
    }
  }

  toggle.addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    paint();
  });

  const form = el('form', { class: 'auth__form', novalidate: true }, [
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'email' }, ['Correo']),
      email,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'password' }, ['Contraseña']),
      password,
    ]),
    submit,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailValue = email.value.trim();
    const passwordValue = password.value;

    if (!emailValue || passwordValue.length < 6) {
      toast('Revisa el correo y que la contraseña tenga al menos 6 caracteres.', 'error');
      return;
    }

    submit.setAttribute('disabled', 'true');
    const original = submit.textContent;
    submit.textContent = mode === 'signin' ? 'Entrando…' : 'Creando…';

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailValue,
          password: passwordValue,
        });
        if (error) throw error;
        // El cambio de sesión lo captura main.ts y pinta el tablero.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailValue,
          password: passwordValue,
          options: {
            // A dónde regresa el enlace de confirmación del correo. Se arma
            // con la URL desde la que realmente se registró la persona (local
            // en desarrollo, GitHub Pages en producción), en vez de depender
            // del "Site URL" fijo configurado en el panel de Supabase.
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
          },
        });
        if (error) throw error;
        // Si el proyecto exige confirmación por correo, no habrá sesión todavía.
        if (!data.session) {
          toast('Cuenta creada. Revisa tu correo para confirmarla antes de entrar.', 'success');
          mode = 'signin';
          paint();
        }
      }
    } catch (err) {
      toast(errorMessage(err, 'No se pudo completar. Verifica tus datos.'), 'error');
    } finally {
      submit.removeAttribute('disabled');
      submit.textContent = original;
    }
  });

  const card = el('div', { class: 'auth__card' }, [
    el('div', { class: 'brand brand--auth' }, [
      el('img', {
        class: 'brand__mark',
        src: `${import.meta.env.BASE_URL}logo-kroton-naranja.png`,
        alt: 'Kroton',
      }),
      el('span', { class: 'brand__name' }, ['KROTON HABITOS']),
    ]),
    title,
    subtitle,
    form,
    el('div', { class: 'auth__switch' }, [switchText, toggle]),
  ]);

  root.append(el('div', { class: 'auth' }, [card]));
  paint();
}
