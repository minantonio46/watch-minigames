'use strict';

let selected = Object.prototype.hasOwnProperty.call(cards, location.hash.slice(1)) ? location.hash.slice(1) : null;
selected = selected || orderedCards()[0];

const carouselNode = $('#carousel');
const container = $('#carousel-track');
let emblaApi = null;
let slides = [];

function buildSlides() {
  const ids = orderedCards();
  container.innerHTML = '';
  ids.forEach(id => {
    const slide = document.createElement('div');
    slide.className = 'embla__slide';
    slide.dataset.game = id;
    slide.innerHTML = `
      <button class="carousel-card" type="button">
        <div class="card-inner">
          <span class="card-icon" aria-hidden="true">${cards[id].icon}</span>
          <strong class="card-title">${cards[id].title()}</strong>
          <span class="card-help">${cards[id].help()}</span>
        </div>
      </button>
    `;
    container.appendChild(slide);
  });
}

function applyContinuousTween() {
  if (!emblaApi || !carouselNode) return;
  const isLightTheme = document.documentElement.dataset.theme === 'light';
  const carouselRect = carouselNode.getBoundingClientRect();
  if (!carouselRect.width) return;
  const viewportCenter = carouselRect.left + carouselRect.width / 2;
  const deadZone = 8;
  const maxDist = carouselRect.width * 0.58;

  slides.forEach(slide => {
    const rect = slide.getBoundingClientRect();
    const slideCenter = rect.left + rect.width / 2;
    const offsetFromCenter = slideCenter - viewportCenter;
    const dist = Math.abs(offsetFromCenter);

    const progress = dist <= deadZone ? 0 : Math.min(1, (dist - deadZone) / (maxDist - deadZone));

    const scale = 1.0 - progress * 0.16;
    const opacity = 1.0 - progress * 0.40;
    const helpOpacity = dist <= deadZone ? 1 : Math.max(0, 1.0 - ((dist - deadZone) / (carouselRect.width * 0.18)));
    const direction = dist <= deadZone ? 0 : (offsetFromCenter < 0 ? 1 : -1);
    const innerShift = direction * progress * carouselRect.width * 0.16;

    const card = slide.querySelector('.carousel-card');
    if (card) {
      card.style.transform = `scale(${scale.toFixed(4)})`;
      card.style.opacity = opacity.toFixed(4);
      if (dist < 20) {
        card.style.zIndex = '2';
        card.style.boxShadow = isLightTheme ? 'none' : '0 10px 32px #0004';
      } else {
        card.style.zIndex = '1';
        card.style.boxShadow = isLightTheme ? 'none' : '0 8px 24px #0002';
      }
    }

    const inner = slide.querySelector('.card-inner');
    if (inner) {
      inner.style.transform = `translateX(${innerShift.toFixed(2)}px)`;
    }

    const help = slide.querySelector('.card-help');
    if (help) {
      help.style.opacity = helpOpacity.toFixed(4);
    }
  });
}
window.applyMenuTween = applyContinuousTween;

function updateStates() {
  if (!emblaApi) return;
  slides = emblaApi.slideNodes();
  const selectedIndex = emblaApi.selectedScrollSnap();
  const length = slides.length;
  const prevIndex = (selectedIndex - 1 + length) % length;
  const nextIndex = (selectedIndex + 1) % length;

  slides.forEach((slide, index) => {
    slide.classList.remove('is-selected', 'is-prev', 'is-next');
    const btn = slide.querySelector('.carousel-card');
    const icon = slide.querySelector('.card-icon');
    const title = slide.querySelector('.card-title');
    const help = slide.querySelector('.card-help');

    btn.removeAttribute('id');
    icon.removeAttribute('id');
    title.removeAttribute('id');
    help.removeAttribute('id');

    const gameId = slide.dataset.game;
    const gameData = cards[gameId];
    title.textContent = gameData.title();
    help.textContent = gameData.help();

    if (index === selectedIndex) {
      slide.classList.add('is-selected');
      btn.id = 'selected-card';
      icon.id = 'card-icon';
      title.id = 'card-title';
      help.id = 'card-help';
      btn.setAttribute('aria-label', tr('열기: ', 'Open: ') + gameData.title());
    } else if (index === prevIndex) {
      slide.classList.add('is-prev');
      btn.id = 'previous';
      icon.id = 'prev-icon';
      title.id = 'prev-title';
      btn.setAttribute('aria-label', tr('이전: ', 'Previous: ') + gameData.title());
    } else if (index === nextIndex) {
      slide.classList.add('is-next');
      btn.id = 'next';
      icon.id = 'next-icon';
      title.id = 'next-title';
      btn.setAttribute('aria-label', tr('다음: ', 'Next: ') + gameData.title());
    }
  });

  selected = slides[selectedIndex].dataset.game;
  $('#position').textContent = `${selectedIndex + 1} / ${length}`;
  const favorite = $('#favorite');
  const active = favorites.includes(selected);
  favorite.disabled = selected === 'settings';
  favorite.style.visibility = selected === 'settings' ? 'hidden' : 'visible';
  favorite.textContent = active ? '★' : '☆';
  favorite.setAttribute('aria-pressed', String(active));
  favorite.setAttribute('aria-label', active ? tr('즐겨찾기 해제', 'Remove favorite') : tr('즐겨찾기 추가', 'Add favorite'));

  applyContinuousTween();
}

function renderMenu() {
  updateStates();
}
window.renderMenu = renderMenu;

function attachListeners() {
  slides.forEach((slide, index) => {
    const btn = slide.querySelector('.carousel-card');
    btn.onclick = () => {
      const selectedIndex = emblaApi.selectedScrollSnap();
      if (index === selectedIndex) {
        location.hash = slide.dataset.game;
      } else {
        emblaApi.scrollTo(index);
      }
    };
  });
}

function initEmbla() {
  buildSlides();
  if (typeof EmblaCarousel === 'function') {
    const startIndex = Math.max(0, orderedCards().indexOf(selected));
    emblaApi = EmblaCarousel(carouselNode, {
      loop: true,
      align: 'center',
      containScroll: false,
      startIndex,
    });
    slides = emblaApi.slideNodes();
    attachListeners();
    emblaApi.on('scroll', applyContinuousTween);
    emblaApi.on('select', updateStates);
    emblaApi.on('init', updateStates);
    emblaApi.on('reInit', updateStates);
  }
  updateStates();
  requestAnimationFrame(() => {
    $('#menu').classList.add('is-ready');
    $('#menu').setAttribute('aria-busy', 'false');
  });
}

function reInitEmbla(maintainSelected = true) {
  if (!emblaApi) return;
  const prevSelected = maintainSelected ? selected : null;

  emblaApi.destroy();
  emblaApi = null;

  buildSlides();

  const startIndex = prevSelected
    ? Math.max(0, orderedCards().indexOf(prevSelected))
    : 0;

  if (typeof EmblaCarousel === 'function') {
    emblaApi = EmblaCarousel(carouselNode, {
      loop: true,
      align: 'center',
      containScroll: false,
      startIndex,
    });
    slides = emblaApi.slideNodes();
    attachListeners();
    emblaApi.on('scroll', applyContinuousTween);
    emblaApi.on('select', updateStates);
    emblaApi.on('reInit', updateStates);
  }

  // Embla applies its initial translate via rAF internally.
  // Wait two frames so getBoundingClientRect() in applyContinuousTween
  // sees the correct slide positions before we update states.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    updateStates();
  }));
}

function syncVisibleMenu() {
  if (!emblaApi || $('#menu').hidden) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if ($('#menu').hidden) return;
    const index = slides.findIndex(slide => slide.dataset.game === selected);
    emblaApi.reInit();
    slides = emblaApi.slideNodes();
    if (index >= 0) emblaApi.scrollTo(index, true);
    updateStates();
  }));
}
window.syncVisibleMenu = syncVisibleMenu;

window.addEventListener('resize', () => {
  if (emblaApi) applyContinuousTween();
});

function toggleFavoriteAction() {
  if (selected === 'settings') return;
  const favBtn = $('#favorite');
  favBtn.classList.remove('pop');
  void favBtn.offsetWidth;
  favBtn.classList.add('pop');
  favorites = favorites.includes(selected) ? favorites.filter(id => id !== selected) : [selected, ...favorites];
  writePreference('watch-favorites', favorites);
  reInitEmbla(true);
}

const menuFooter = $('.menu-footer');
if (menuFooter) {
  menuFooter.addEventListener('click', () => {
    toggleFavoriteAction();
  });
}

window.addEventListener('keydown', event => {
  if (location.hash || !emblaApi) return;
  const resetRecordsDialog = $('#reset-records-confirm');
  if (resetRecordsDialog && !resetRecordsDialog.hidden) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault(); emblaApi.scrollPrev();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault(); emblaApi.scrollNext();
  }
});

// Initialization
applyTheme();
initEmbla();
applyLanguage();
