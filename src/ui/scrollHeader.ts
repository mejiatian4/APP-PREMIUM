/** Oculta el header al bajar el scroll y lo muestra al subir (o cerca del tope). */
export function initHeaderAutoHide(): void {
  // Evita registrar el listener más de una vez si esta función se llega a
  // invocar dos veces en la misma página (p. ej. un hot-reload de Vite que
  // reejecuta el módulo): dos listeners con su propio estado "pelean" entre
  // sí y el header se queda a medio esconder.
  const w = window as unknown as { __krotonHeaderAutoHideInit?: boolean };
  if (w.__krotonHeaderAutoHideInit) return;
  w.__krotonHeaderAutoHideInit = true;

  let lastY = Math.max(0, window.scrollY);
  let hidden = false;
  let ticking = false;

  // Delta mínimo para considerar que el usuario realmente cambió de dirección.
  // Sin esto, el "rebote" de la inercia del scroll (trackpad/mouse suave) puede
  // registrar un pixel hacia arriba en medio de un scroll hacia abajo y volver
  // a mostrar el header, que se queda así aunque el usuario siga bajando.
  const THRESHOLD = 6;

  function setHidden(next: boolean): void {
    if (hidden === next) return;
    hidden = next;
    document.querySelectorAll<HTMLElement>('.ig-topbar, .topbar').forEach((bar) => {
      bar.classList.toggle('is-hidden', hidden);
    });
  }

  function onScroll(): void {
    const y = Math.max(0, window.scrollY);
    const delta = y - lastY;

    if (y <= 80) setHidden(false);
    else if (delta > THRESHOLD) setHidden(true);
    else if (delta < -THRESHOLD) setHidden(false);

    lastY = y;
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    },
    { passive: true },
  );
}
