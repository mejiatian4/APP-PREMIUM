import { supabase } from '../lib/supabase';
import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { toast, errorMessage } from '../ui/toast';

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Exige contraseña "fuerte" solo al crear cuenta: letras, números y un
 * carácter especial. A las cuentas existentes no se les pide retroactivamente,
 * por eso esta regla no se aplica al iniciar sesión.
 */
function passwordStrengthError(value: string): string | null {
  if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(value)) return 'La contraseña debe incluir al menos una letra.';
  if (!/[0-9]/.test(value)) return 'La contraseña debe incluir al menos un número.';
  if (!/[^a-zA-Z0-9]/.test(value)) return 'La contraseña debe incluir al menos un carácter especial (ej. !@#$%).';
  return null;
}

/** Campo de contraseña con botón para mostrar/ocultar el texto. */
function passwordField(attrs: Record<string, string | number | boolean>): {
  input: HTMLInputElement;
  wrap: HTMLElement;
} {
  const input = el('input', { type: 'password', class: 'field__input', ...attrs }) as HTMLInputElement;
  const toggle = el('button', {
    type: 'button',
    class: 'field__visibility',
    'aria-label': 'Mostrar contraseña',
  }, [icons.eye()]);

  let visible = false;
  toggle.addEventListener('click', () => {
    visible = !visible;
    input.type = visible ? 'text' : 'password';
    clear(toggle);
    toggle.append(visible ? icons.eyeOff() : icons.eye());
    toggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  const wrap = el('div', { class: 'field__input-wrap' }, [input, toggle]);
  return { input, wrap };
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

  const { input: password, wrap: passwordWrap } = passwordField({
    id: 'password',
    placeholder: 'Mínimo 8 caracteres',
    autocomplete: 'current-password',
    required: true,
    minLength: 6,
  });
  const passwordHint = el('p', { class: 'field__hint' });

  const { input: confirmPassword, wrap: confirmPasswordWrap } = passwordField({
    id: 'confirm-password',
    placeholder: 'Repite tu contraseña',
    autocomplete: 'new-password',
  });
  const confirmHint = el('p', { class: 'field__hint' });
  const confirmField = el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: 'confirm-password' }, ['Confirmar contraseña']),
    confirmPasswordWrap,
    confirmHint,
  ]);

  function updateConfirmHint(): void {
    if (mode !== 'signup' || !confirmPassword.value) {
      confirmHint.textContent = '';
      confirmHint.classList.remove('field__hint--ok', 'field__hint--error');
      return;
    }
    if (confirmPassword.value === password.value) {
      confirmHint.textContent = 'Las contraseñas coinciden.';
      confirmHint.classList.add('field__hint--ok');
      confirmHint.classList.remove('field__hint--error');
    } else {
      confirmHint.textContent = 'Las contraseñas no coinciden.';
      confirmHint.classList.add('field__hint--error');
      confirmHint.classList.remove('field__hint--ok');
    }
  }
  password.addEventListener('input', updateConfirmHint);
  confirmPassword.addEventListener('input', updateConfirmHint);

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
      password.setAttribute('placeholder', 'Mínimo 8 caracteres');
      password.setAttribute('minlength', '6');
      passwordHint.textContent = '';
      confirmField.style.display = 'none';
      confirmPassword.value = '';
      updateConfirmHint();
    } else {
      title.textContent = 'Crea tu cuenta';
      subtitle.textContent = 'Empieza a registrar tus hábitos hoy mismo.';
      submit.textContent = 'Crear cuenta';
      switchText.textContent = '¿Ya tienes cuenta?';
      toggle.textContent = 'Inicia sesión';
      password.setAttribute('autocomplete', 'new-password');
      password.setAttribute('placeholder', 'Mínimo 8 caracteres');
      password.setAttribute('minlength', '8');
      passwordHint.textContent = 'Debe incluir letras, números y un carácter especial (ej. !@#$%).';
      confirmField.style.display = '';
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
      passwordWrap,
      passwordHint,
    ]),
    confirmField,
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

    if (mode === 'signup') {
      const strengthError = passwordStrengthError(passwordValue);
      if (strengthError) {
        toast(strengthError, 'error');
        return;
      }
      if (passwordValue !== confirmPassword.value) {
        toast('Las contraseñas no coinciden.', 'error');
        return;
      }
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
          toast('Cuenta creada. Revisa tu correo para confirmarla antes de entrar.', 'success', 20000);
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
