/** Oculta el header al bajar el scroll y lo muestra al subir (o cerca del tope). */
export function initHeaderAutoHide(): void {
  let lastY = window.scrollY;
  let ticking = false;

  function setHidden(hidden: boolean): void {
    document.querySelectorAll<HTMLElement>('.ig-topbar, .topbar').forEach((bar) => {
      bar.classList.toggle('is-hidden', hidden);
    });
  }

  function onScroll(): void {
    const y = window.scrollY;
    if (y > lastY && y > 80) setHidden(true);
    else if (y < lastY || y <= 80) setHidden(false);
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
