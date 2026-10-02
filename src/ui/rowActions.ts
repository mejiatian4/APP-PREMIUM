import { el } from './dom';
import { icons } from './icons';

/** Botón circular de check (hábito/meta/agenda cumplidos), mismo ícono y clase en toda la app. */
export function createCheckToggle(done: boolean, ariaLabel: string, onToggle: () => void): HTMLButtonElement {
  const btn = el(
    'button',
    { class: 'goal-check' + (done ? ' goal-check--on' : ''), type: 'button', 'aria-label': ariaLabel },
    [icons.check()],
  );
  btn.addEventListener('click', onToggle);
  return btn;
}

/** Par de botones "editar"/"eliminar" con el mismo ícono y estilo en toda la app. */
export function createEditDeleteButtons(
  label: string,
  onEdit: () => void,
  onDelete: () => void,
): { editBtn: HTMLButtonElement; delBtn: HTMLButtonElement } {
  const editBtn = el(
    'button',
    { class: 'iconbtn', type: 'button', 'aria-label': `Editar ${label}` },
    [icons.pencil()],
  );
  editBtn.addEventListener('click', onEdit);

  const delBtn = el(
    'button',
    { class: 'iconbtn iconbtn--danger', type: 'button', 'aria-label': `Eliminar ${label}` },
    [icons.trash()],
  );
  delBtn.addEventListener('click', onDelete);

  return { editBtn, delBtn };
}
