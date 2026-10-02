/** Carrusel de "Tienda Kroton": avanza solo cada 5s y hace loop infinito en ambas direcciones. */
export function initShopCarousel(): void {
  const track = document.getElementById('shopCarouselTrack');
  const prevBtn = document.querySelector<HTMLButtonElement>('.shop-carousel__nav--prev');
  const nextBtn = document.querySelector<HTMLButtonElement>('.shop-carousel__nav--next');
  if (!track) return;

  // Evita duplicar los ítems y los listeners si esto se llega a invocar dos
  // veces sobre el mismo track (p. ej. un hot-reload de Vite).
  if (track.dataset.carouselInit) return;
  track.dataset.carouselInit = 'true';

  const originalItems = Array.from(track.children) as HTMLElement[];
  if (originalItems.length === 0) return;

  // Clonamos los ítems DOS veces —uno antes y otro después del bloque
  // real— para poder hacer loop infinito en las dos direcciones: siempre
  // hay contenido "de sobra" a cada lado para seguir scrolleando sin
  // toparse con un límite, sea con las flechas, el mouse o swipe.
  const makeClones = (): HTMLElement[] =>
    originalItems.map((item) => {
      const clone = item.cloneNode(true) as HTMLElement;
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
      return clone;
    });

  track.append(...makeClones());
  track.prepend(...makeClones());

  const itemStep = (): number => {
    const item = track.children[0] as HTMLElement;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || '0');
    return item.getBoundingClientRect().width + gap;
  };
  const loopWidth = (): number => itemStep() * originalItems.length;

  // Arranca mostrando el bloque real (el del medio), con un bloque clonado
  // completo disponible a cada lado para scrollear.
  track.scrollLeft = loopWidth();

  // Esperamos a que el scroll (animado o por swipe) se asiente antes de
  // reubicar, para no pelear con la animación nativa en curso.
  let settleTimer = 0;
  track.addEventListener('scroll', () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const width = loopWidth();
      if (track.scrollLeft <= 1) track.scrollLeft += width;
      else if (track.scrollLeft >= width * 2 - 1) track.scrollLeft -= width;
    }, 120);
  });

  const next = (): void => track.scrollBy({ left: itemStep(), behavior: 'smooth' });
  const prev = (): void => track.scrollBy({ left: -itemStep(), behavior: 'smooth' });

  let timer = window.setInterval(next, 5000);
  const restartAutoplay = (): void => {
    window.clearInterval(timer);
    timer = window.setInterval(next, 5000);
  };

  prevBtn?.addEventListener('click', () => {
    prev();
    restartAutoplay();
  });
  nextBtn?.addEventListener('click', () => {
    next();
    restartAutoplay();
  });

  // Pausa mientras el mouse está encima, para no interrumpir al usuario.
  const wrap = track.closest<HTMLElement>('.shop-carousel__wrap');
  wrap?.addEventListener('mouseenter', () => window.clearInterval(timer));
  wrap?.addEventListener('mouseleave', restartAutoplay);
}
