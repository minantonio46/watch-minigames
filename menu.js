'use strict';
function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
}
function writePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}
let language = readPreference('watch-language', 'ko');
if (!['ko', 'en'].includes(language)) language = 'ko';
let theme = readPreference('watch-theme', 'dark');
if (!['dark', 'light', 'system'].includes(theme)) theme = 'dark';
let favorites = readPreference('watch-favorites', []);
if (!Array.isArray(favorites)) favorites = [];
favorites = favorites.filter(id => ['reaction', 'taps', 'timing'].includes(id));
const tr = (ko, en) => language === 'ko' ? ko : en;
const cards = {
  reaction: { icon: 'ϟ', title: () => tr('반응속도', 'Reaction'), help: () => tr('초록색이면 터치', 'Tap when green') },
  taps: { icon: '◎', title: () => tr('10초 연타', 'Tap Rush'), help: () => tr('10초 동안 빠르게', 'Tap fast for 10 seconds') },
  timing: { icon: '◷', title: () => tr('5초 맞추기', 'Five Seconds'), help: () => tr('나만의 시간 감각', 'Feel the five-second mark') },
  settings: { icon: '⚙', title: () => tr('설정', 'Settings'), help: () => tr('언어 · 화면 테마', 'Language · Theme') }
};
let selected = Object.prototype.hasOwnProperty.call(cards, location.hash.slice(1)) ? location.hash.slice(1) : null;
function orderedCards() {
  const ids = ['reaction', 'taps', 'timing'];
  return [...ids.filter(id => favorites.includes(id)), ...ids.filter(id => !favorites.includes(id)), 'settings'];
}
selected = selected || orderedCards()[0];

const carouselNode = document.querySelector('#carousel');
const container = document.querySelector('#carousel-track');
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
        card.style.boxShadow = '0 10px 32px #0004';
      } else {
        card.style.zIndex = '1';
        card.style.boxShadow = '0 8px 24px #0002';
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
  document.querySelector('#position').textContent = `${selectedIndex + 1} / ${length}`;
  const favorite = document.querySelector('#favorite');
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

function moveCard(step) {
  if (!emblaApi) return;
  if (step > 0) emblaApi.scrollNext();
  else emblaApi.scrollPrev();
}

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
    emblaApi = EmblaCarousel(carouselNode, {
      loop: true,
      align: 'center',
      containScroll: false
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
    document.querySelector('#menu').classList.add('is-ready');
    document.querySelector('#menu').setAttribute('aria-busy', 'false');
  });
}

function reInitEmbla(maintainSelected = true) {
  if (!emblaApi) return;
  const prevSelected = selected;
  buildSlides();
  emblaApi.reInit();
  slides = emblaApi.slideNodes();
  attachListeners();
  if (maintainSelected) {
    const ids = orderedCards();
    const newIndex = ids.indexOf(prevSelected);
    if (newIndex >= 0) emblaApi.scrollTo(newIndex, true);
  }
  updateStates();
}

window.addEventListener('resize', () => {
  if (emblaApi) applyContinuousTween();
});

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const resolved = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]').content = resolved === 'dark' ? '#080c12' : '#f3f6fb';
}
if (systemTheme.addEventListener) systemTheme.addEventListener('change', applyTheme);

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = tr('워치 미니게임', 'Watch Minigames');
  document.querySelector('#site-title').textContent = document.title;
  document.querySelector('#settings-title').textContent = tr('설정', 'Settings');
  document.querySelector('#language-label').textContent = tr('언어', 'Language');
  document.querySelector('#theme-label').textContent = tr('화면 테마', 'Theme');
  document.querySelector('#theme option[value="dark"]').textContent = tr('다크 모드', 'Dark');
  document.querySelector('#theme option[value="light"]').textContent = tr('라이트 모드', 'Light');
  document.querySelector('#theme option[value="system"]').textContent = tr('기기 설정', 'System');
  document.querySelector('#back-label').textContent = tr('메뉴', 'Menu');
  document.querySelector('#back').setAttribute('aria-label', tr('메뉴로 돌아가기', 'Return to menu'));
  document.querySelector('#settings-back').textContent = tr('‹ 메뉴', '‹ Menu');
  document.querySelector('#game').setAttribute('aria-label', tr('게임', 'Game'));
  document.querySelector('#carousel').setAttribute('aria-label', tr('게임 선택', 'Choose a game'));
  updateStates();
}

document.querySelector('#favorite').addEventListener('click', () => {
  if (selected === 'settings') return;
  const favBtn = document.querySelector('#favorite');
  favBtn.classList.remove('pop');
  void favBtn.offsetWidth;
  favBtn.classList.add('pop');
  favorites = favorites.includes(selected) ? favorites.filter(id => id !== selected) : [...favorites, selected];
  writePreference('watch-favorites', favorites);
  reInitEmbla(true);
});

document.querySelector('#settings-back').addEventListener('click', () => { location.hash = ''; });
document.querySelector('#language').value = language;
document.querySelector('#theme').value = theme;
document.querySelector('#language').addEventListener('change', event => {
  language = event.target.value; writePreference('watch-language', language); applyLanguage();
});
document.querySelector('#theme').addEventListener('change', event => {
  theme = event.target.value; writePreference('watch-theme', theme); applyTheme();
});

window.addEventListener('keydown', event => {
  if (location.hash || !emblaApi) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault(); emblaApi.scrollPrev();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault(); emblaApi.scrollNext();
  }
});

applyTheme();
initEmbla();
applyLanguage();

