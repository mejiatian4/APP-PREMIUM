/** Carrusel de "Tienda Kroton": avanza solo cada 5s y hace loop infinito. */
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

  // Duplicamos los ítems una vez: al llegar al bloque clonado saltamos sin
  // animación al punto equivalente del bloque real, así el scroll nunca
  // "se acaba" y el carrusel se siente infinito.
  originalItems.forEach((item) => {
    const clone = item.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
    track.appendChild(clone);
  });

  const itemStep = (): number => {
    const item = track.children[0] as HTMLElement;
    const style = getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || '0');
    return item.getBoundingClientRect().width + gap;
  };
  const loopWidth = (): number => itemStep() * originalItems.length;

  // Esperamos a que el scroll (animado o por swipe) se asiente antes de
  // reubicar, para no pelear con la animación nativa en curso.
  let settleTimer = 0;
  track.addEventListener('scroll', () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      const width = loopWidth();
      if (track.scrollLeft >= width - 1) track.scrollLeft -= width;
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
