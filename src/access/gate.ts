import { el, clear } from '../ui/dom';
import { toast, errorMessage } from '../ui/toast';
import { signOut } from '../auth/auth';
import { redeemAccessCode } from './api';

/**
 * Pantalla intermedia entre iniciar sesión y ver el tablero: pide el código
 * de 6 dígitos de la tirilla de la prenda. Se muestra solo hasta que la
 * cuenta canjea uno; después nunca vuelve a aparecer para ese usuario.
 */
export function renderAccessGate(root: HTMLElement, onSuccess: () => void): void {
  clear(root);

  const title = el('h1', { class: 'auth__title' }, ['Activa tu cuenta']);
  const subtitle = el('p', { class: 'auth__subtitle' }, [
    'Introduce el código de 6 caracteres que está pegado en la tirilla de la prenda que adquiriste en KROTON.',
  ]);

  const code = el('input', {
    type: 'text',
    class: 'field__input field__input--code',
    id: 'access-code',
    inputmode: 'text',
    autocapitalize: 'characters',
    autocomplete: 'off',
    maxLength: 6,
    placeholder: 'ABC234',
    required: true,
  }) as HTMLInputElement;

  code.addEventListener('input', () => {
    code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  });

  const submit = el('button', { type: 'submit', class: 'btn btn--primary btn--block' }, ['Validar código']);

  const form = el('form', { class: 'auth__form', novalidate: true }, [
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'access-code' }, ['Código de 6 caracteres']),
      code,
    ]),
    submit,
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = code.value.trim();
    if (value.length !== 6) {
      toast('El código debe tener 6 caracteres.', 'error');
      return;
    }

    submit.setAttribute('disabled', 'true');
    const original = submit.textContent;
    submit.textContent = 'Validando…';

    try {
      await redeemAccessCode(value);
      toast('¡Código activado!', 'success');
      onSuccess();
    } catch (err) {
      toast(errorMessage(err, 'No se pudo validar el código.'), 'error');
      submit.removeAttribute('disabled');
      submit.textContent = original;
    }
  });

  const signOutBtn = el('button', { type: 'button', class: 'auth__toggle' }, ['Cerrar sesión']);
  signOutBtn.addEventListener('click', () => void signOut());

  const card = el('div', { class: 'auth__card' }, [
    el('div', { class: 'brand brand--auth' }, [
      el('img', {
        class: 'brand__mark',
        src: `${import.meta.env.BASE_URL}logo-kroton-naranja.png`,
        alt: 'Kroton',
      }),
    ]),
    title,
    subtitle,
    form,
    el('div', { class: 'auth__switch' }, ['¿No es tu cuenta? ', signOutBtn]),
  ]);

  root.append(el('div', { class: 'auth' }, [card]));
}
