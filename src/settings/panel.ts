import { el } from '../ui/dom';
import { icons } from '../ui/icons';
import { toast, errorMessage } from '../ui/toast';
import { listGoals } from '../goals/api';
import { downloadGoalsPdf } from '../goals/pdf';
import { deleteAccount } from './api';
import { signOut } from '../auth/auth';
import { dismiss, mountOverlay } from '../ui/modal';

function openOverlay(card: HTMLElement): HTMLElement {
  const overlay = el('div', { class: 'modal' }, [card]);
  mountOverlay(overlay, () => dismiss(overlay));
  return overlay;
}

/** Abre el panel de configuración: exportar metas a PDF y eliminar la cuenta. */
export function openSettingsPanel(userEmail: string): void {
  const downloadBtn = el('button', { class: 'btn btn--soft btn--block', type: 'button' }, [
    icons.download(),
    el('span', {}, ['Descargar mis metas (PDF)']),
  ]);
  downloadBtn.addEventListener('click', () => void onDownload());

  const deleteBtn = el('button', { class: 'btn btn--danger btn--block', type: 'button' }, [
    icons.trash(),
    el('span', {}, ['Eliminar mi cuenta']),
  ]);
  deleteBtn.addEventListener('click', () => {
    dismiss(overlay);
    openDeleteConfirm(userEmail);
  });

  const closeBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, ['Cerrar']);
  closeBtn.addEventListener('click', () => dismiss(overlay));

  const card = el('div', { class: 'modal__card', role: 'dialog', 'aria-modal': 'true' }, [
    el('h2', { class: 'modal__title' }, ['Configuración']),
    el('div', { class: 'settings-section' }, [
      el('h3', { class: 'settings-section__title' }, ['Exportar datos']),
      el('p', { class: 'settings-section__text' }, [
        'Descarga un documento con todas las metas que te has propuesto, agrupadas por plazo, con su estado y fechas.',
      ]),
      downloadBtn,
    ]),
    el('div', { class: 'settings-section settings-section--danger' }, [
      el('h3', { class: 'settings-section__title' }, ['Zona de peligro']),
      el('p', { class: 'settings-section__text' }, [
        'Elimina tu cuenta y todos tus datos de KROTON HABITOS de forma permanente.',
      ]),
      deleteBtn,
    ]),
    el('div', { class: 'modal__actions' }, [closeBtn]),
  ]);

  const overlay = openOverlay(card);

  async function onDownload(): Promise<void> {
    downloadBtn.setAttribute('disabled', 'true');
    const label = downloadBtn.querySelector('span');
    const originalText = label?.textContent ?? '';
    if (label) label.textContent = 'Generando…';
    try {
      const goals = await listGoals();
      await downloadGoalsPdf(goals, userEmail);
      toast('PDF descargado.', 'success');
    } catch (err) {
      toast(errorMessage(err, 'No se pudo generar el PDF.'), 'error');
    } finally {
      downloadBtn.removeAttribute('disabled');
      if (label) label.textContent = originalText;
    }
  }
}

const CONFIRM_WORD = 'ELIMINAR';

function openDeleteConfirm(userEmail: string): void {
  const confirmInput = el('input', {
    type: 'text',
    class: 'field__input',
    placeholder: CONFIRM_WORD,
    autocomplete: 'off',
  });
  const cancelBtn = el('button', { type: 'button', class: 'btn btn--ghost' }, ['Cancelar']);
  const confirmBtn = el(
    'button',
    { type: 'button', class: 'btn btn--danger', disabled: true },
    ['Eliminar cuenta permanentemente'],
  );

  confirmInput.addEventListener('input', () => {
    const match = confirmInput.value.trim().toUpperCase() === CONFIRM_WORD;
    if (match) confirmBtn.removeAttribute('disabled');
    else confirmBtn.setAttribute('disabled', 'true');
  });

  const card = el('div', { class: 'modal__card', role: 'alertdialog', 'aria-modal': 'true' }, [
    el('div', { class: 'modal__danger-icon' }, [icons.alertTriangle()]),
    el('h2', { class: 'modal__title' }, ['¿Eliminar tu cuenta?']),
    el('p', { class: 'modal__message' }, [
      `Esta acción es permanente y no se puede deshacer. Al eliminar la cuenta ${userEmail} también se borra para siempre:`,
    ]),
    el('ul', { class: 'modal__list' }, [
      el('li', {}, ['Todos tus hábitos y el historial completo de días marcados.']),
      el('li', {}, ['Todas tus metas de corto, mediano y largo plazo.']),
      el('li', {}, ['Tu acceso con este correo — para volver a usar la app necesitarías crear una cuenta nueva.']),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, [`Escribe ${CONFIRM_WORD} para confirmar`]),
      confirmInput,
    ]),
    el('div', { class: 'modal__actions' }, [cancelBtn, confirmBtn]),
  ]);

  const overlay = openOverlay(card);
  cancelBtn.addEventListener('click', () => dismiss(overlay));
  confirmBtn.addEventListener('click', () => void onConfirmDelete());
  confirmInput.focus();

  async function onConfirmDelete(): Promise<void> {
    confirmBtn.setAttribute('disabled', 'true');
    confirmBtn.textContent = 'Eliminando…';
    try {
      await deleteAccount();
      dismiss(overlay);
      toast('Tu cuenta fue eliminada.', 'success');
      await signOut();
    } catch (err) {
      toast(errorMessage(err, 'No se pudo eliminar la cuenta.'), 'error');
      confirmBtn.textContent = 'Eliminar cuenta permanentemente';
      confirmBtn.removeAttribute('disabled');
    }
  }
}