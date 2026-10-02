import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { renderCoachChat } from './chat';

/**
 * Monta el coach como un botón flotante (abajo a la derecha) que despliega
 * un panel de chat anclado a esa esquina — en vez de ser una subpestaña más,
 * así queda accesible desde cualquier parte de la app (Hábitos o FitPlan)
 * sin perder la conversación al cambiar de sección. El chat en sí (mensajes,
 * historial, llamada al backend) se arma la primera vez que se abre el
 * panel, no al cargar el dashboard.
 *
 * Se monta directo en <body> (mismo patrón que ui/toast.ts), NO dentro del
 * árbol de #app: `.app` tiene `position:relative; z-index:1`, lo que la
 * convierte en su propio contexto de apilamiento — cualquier z-index puesto
 * ADENTRO (por alto que sea) queda atrapado ahí y no puede competir con
 * hermanos de #app que también tengan z-index propio, como `.shop-carousel`.
 * Montado en <body>, el z-index del widget compite en el nivel raíz de
 * verdad y gana donde tenga que ganar.
 */
export function mountCoachWidget(): void {
  // Por si ya existe uno de una sesión anterior (login -> logout -> login de
  // nuevo dispara otro renderDashboard): se reemplaza en vez de duplicarse.
  unmountCoachWidget();

  let open = false;
  let chatMounted = false;

  const fabIcon = el('span', { class: 'coach-fab__icon', 'aria-hidden': 'true' }, [icons.sparkles()]);
  const fab = el(
    'button',
    { class: 'coach-fab', type: 'button', 'aria-label': 'Hablar con el coach', 'aria-expanded': 'false' },
    [fabIcon],
  );

  const panel = el('div', { class: 'coach-panel' });

  // Al abrir, difumina el resto de la página detrás del panel: sin esto, el
  // chat queda flotando a secas sobre lo que haya en ese scroll (la agenda,
  // el carrusel de la tienda, lo que sea) y se ve como un elemento suelto en
  // vez de una ventana propia con foco.
  const backdrop = el('div', { class: 'coach-backdrop' });
  backdrop.addEventListener('click', () => setOpen(false));

  const widget = el('div', { class: 'coach-widget' }, [backdrop, panel, fab]);
  document.body.append(widget);

  fab.addEventListener('click', () => setOpen(!open));
  widget.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false);
      fab.focus();
    }
  });

  function setOpen(next: boolean): void {
    open = next;
    widget.classList.toggle('coach-widget--open', open);
    fab.setAttribute('aria-expanded', String(open));
    fab.setAttribute('aria-label', open ? 'Cerrar chat con el coach' : 'Hablar con el coach');
    clear(fabIcon);
    fabIcon.append(open ? icons.close() : icons.sparkles());
    if (open) {
      if (!chatMounted) {
        chatMounted = true;
        renderCoachChat(panel, () => setOpen(false));
      }
    }
  }
}

/** Quita el botón flotante del coach, si existe. Se llama al volver a la pantalla de acceso (logout). */
export function unmountCoachWidget(): void {
  document.querySelector('.coach-widget')?.remove();
}
