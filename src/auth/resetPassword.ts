import { supabase } from '../lib/supabase';
import { el, clear } from '../ui/dom';
import { toast, errorMessage } from '../ui/toast';
import { newPasswordFields, passwordStrengthError } from './auth';

/**
 * Pantalla para poner y confirmar la nueva contraseña, mostrada cuando el
 * usuario vuelve desde el enlace de "recuperar contraseña" del correo.
 */
export function renderResetPasswordScreen(root: HTMLElement, onSuccess: () => void): void {
  clear(root);

  const title = el('h1', { class: 'auth__title' }, ['Crea una nueva contraseña']);
  const subtitle = el('p', { class: 'auth__subtitle' }, [
    'Escribe y confirma la nueva contraseña de tu cuenta.',
  ]);

  const { passwordField, confirmField, password, confirmPassword } = newPasswordFields('reset');

  const submit = el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, ['Guardar nueva contraseña']);

  const form = el('form', { class: 'auth__form', novalidate: true }, [passwordField, confirmField, submit]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = password.value;

    const strengthError = passwordStrengthError(value);
    if (strengthError) {
      toast(strengthError, 'error');
      return;
    }
    if (value !== confirmPassword.value) {
      toast('Las contraseñas no coinciden.', 'error');
      return;
    }

    submit.setAttribute('disabled', 'true');
    const original = submit.textContent;
    submit.textContent = 'Guardando…';

    try {
      const { error } = await supabase.auth.updateUser({ password: value });
      if (error) throw error;
      toast('Contraseña actualizada.', 'success');
      onSuccess();
    } catch (err) {
      toast(errorMessage(err, 'No se pudo actualizar la contraseña.'), 'error');
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
  ]);

  root.append(el('div', { class: 'auth' }, [card]));
}
