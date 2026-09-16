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
let isAnimating = false;

function renderMenu() {
  const ids = orderedCards();
  const index = ids.indexOf(selected);
  const slotOffsets = [-2, -1, 0, 1, 2];
  const slotCards = slotOffsets.map(offset => ids[(index + offset + ids.length * 2) % ids.length]);

  const s0 = document.querySelector('.slot-0');
  if (s0) {
    s0.querySelector('.card-icon').textContent = cards[slotCards[0]].icon;
    s0.querySelector('.card-title').textContent = cards[slotCards[0]].title();
    const s0Help = s0.querySelector('.card-help');
    if (s0Help) s0Help.textContent = cards[slotCards[0]].help();
  }

  const prevButton = document.querySelector('#previous');
  if (prevButton) {
    prevButton.disabled = false;
    document.querySelector('#prev-icon').textContent = cards[slotCards[1]].icon;
    document.querySelector('#prev-title').textContent = cards[slotCards[1]].title();
    const prevHelp = document.querySelector('#prev-help');
    if (prevHelp) prevHelp.textContent = cards[slotCards[1]].help();
    prevButton.setAttribute('aria-label', tr('이전: ', 'Previous: ') + cards[slotCards[1]].title());
  }

  const card = document.querySelector('#selected-card');
  if (card) {
    document.querySelector('#card-icon').textContent = cards[slotCards[2]].icon;
    document.querySelector('#card-title').textContent = cards[slotCards[2]].title();
    const cardHelp = document.querySelector('#card-help');
    if (cardHelp) cardHelp.textContent = cards[slotCards[2]].help();
    card.setAttribute('aria-label', tr('열기: ', 'Open: ') + cards[slotCards[2]].title());
  }

  const nextButton = document.querySelector('#next');
  if (nextButton) {
    nextButton.disabled = false;
    document.querySelector('#next-icon').textContent = cards[slotCards[3]].icon;
    document.querySelector('#next-title').textContent = cards[slotCards[3]].title();
    const nextHelp = document.querySelector('#next-help');
    if (nextHelp) nextHelp.textContent = cards[slotCards[3]].help();
    nextButton.setAttribute('aria-label', tr('다음: ', 'Next: ') + cards[slotCards[3]].title());
  }

  const s4 = document.querySelector('.slot-4');
  if (s4) {
    s4.querySelector('.card-icon').textContent = cards[slotCards[4]].icon;
    s4.querySelector('.card-title').textContent = cards[slotCards[4]].title();
    const s4Help = s4.querySelector('.card-help');
    if (s4Help) s4Help.textContent = cards[slotCards[4]].help();
  }

  document.querySelector('#position').textContent = `${index + 1} / ${ids.length}`;
  const favorite = document.querySelector('#favorite');
  const active = favorites.includes(selected);
  favorite.disabled = selected === 'settings';
  favorite.style.visibility = selected === 'settings' ? 'hidden' : 'visible';
  favorite.textContent = active ? '★' : '☆';
  favorite.setAttribute('aria-pressed', String(active));
  favorite.setAttribute('aria-label', active ? tr('즐겨찾기 해제', 'Remove favorite') : tr('즐겨찾기 추가', 'Add favorite'));
}

function moveCard(step) {
  if (isAnimating || !step) return;
  isAnimating = true;

  const ids = orderedCards();
  const currentIndex = ids.indexOf(selected);
  const nextIndex = (currentIndex + step + ids.length) % ids.length;
  const nextSelected = ids[nextIndex];

  const shiftClass = step > 0 ? 'sliding-next' : 'sliding-prev';
  track.classList.remove('sliding-next', 'sliding-prev');
  track.style.transition = '';
  track.style.transform = '';
  void track.offsetWidth;
  track.classList.add(shiftClass);

  setTimeout(() => {
    selected = nextSelected;
    renderMenu();
    track.classList.remove(shiftClass);
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    void track.offsetWidth;
    track.style.transition = '';
    track.style.transform = '';
    isAnimating = false;
  }, 280);
}
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
  document.querySelector('#back').textContent = tr('‹ 메뉴', '‹ Menu');
  document.querySelector('#settings-back').textContent = tr('‹ 메뉴', '‹ Menu');
  document.querySelector('#game').setAttribute('aria-label', tr('게임', 'Game'));
  document.querySelector('#carousel').setAttribute('aria-label', tr('게임 선택', 'Choose a game'));
  renderMenu();
}
document.querySelector('#previous').addEventListener('click', () => moveCard(-1));
document.querySelector('#next').addEventListener('click', () => moveCard(1));
document.querySelector('#selected-card').addEventListener('click', () => { location.hash = selected; });
document.querySelector('#favorite').addEventListener('click', () => {
  if (selected === 'settings') return;
  const favBtn = document.querySelector('#favorite');
  favBtn.classList.remove('pop');
  void favBtn.offsetWidth;
  favBtn.classList.add('pop');
  favorites = favorites.includes(selected) ? favorites.filter(id => id !== selected) : [...favorites, selected];
  writePreference('watch-favorites', favorites);
  renderMenu();
});
const carousel = document.querySelector('#carousel');
const track = document.querySelector('#carousel-track');
let gesture = null;
let isDragging = false;
let suppressClick = false;
carousel.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || isAnimating) return;
  suppressClick = false;
  isDragging = false;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, startTime: performance.now() };
  if (track) {
    track.style.transition = 'none';
  }
});
window.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId || isAnimating) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!isDragging) {
    if (Math.abs(dx) >= 8 && Math.abs(dx) > Math.abs(dy) * 1.1) {
      isDragging = true;
      suppressClick = true;
    } else if (Math.abs(dy) >= 8) {
      gesture = null;
      return;
    }
  }
  if (isDragging && track) {
    const maxDrag = carousel.clientWidth * 0.45;
    const clampedDx = Math.max(-maxDrag, Math.min(maxDrag, dx));
    track.style.transform = `translateX(${clampedDx}px)`;
  }
});
function endGesture(event) {
  if (!gesture || (event && gesture.id !== event.pointerId)) return;
  const dx = (event ? event.clientX : gesture.x) - gesture.x;
  const dt = performance.now() - gesture.startTime;
  const wasDragging = isDragging;
  gesture = null;
  isDragging = false;
  if (wasDragging && track) {
    suppressClick = true;
    const threshold = 28;
    const fastSwipe = Math.abs(dx) >= 16 && dt < 280;
    if ((Math.abs(dx) >= threshold || fastSwipe) && !isAnimating) {
      const step = dx < 0 ? 1 : -1;
      isAnimating = true;

      const ids = orderedCards();
      const currentIndex = ids.indexOf(selected);
      const nextIndex = (currentIndex + step + ids.length) % ids.length;
      const nextSelected = ids[nextIndex];

      const shiftClass = step > 0 ? 'sliding-next' : 'sliding-prev';
      track.classList.add(shiftClass);
      track.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform = step > 0 ? 'translateX(calc(var(--slot-dist) * -1))' : 'translateX(var(--slot-dist))';

      setTimeout(() => {
        selected = nextSelected;
        renderMenu();
        track.classList.remove(shiftClass);
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        void track.offsetWidth;
        track.style.transition = '';
        track.style.transform = '';
        isAnimating = false;
      }, 220);
    } else {
      track.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
      track.style.transform = 'translateX(0)';
      setTimeout(() => {
        if (track) {
          track.style.transition = '';
          track.style.transform = '';
        }
      }, 200);
    }
  } else if (track) {
    track.style.transition = '';
    track.style.transform = '';
  }
}
window.addEventListener('pointerup', endGesture);
window.addEventListener('pointercancel', endGesture);
carousel.addEventListener('click', event => {
  if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
}, true);
carousel.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); moveCard(event.key === 'ArrowLeft' ? -1 : 1);
  }
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
applyTheme();
applyLanguage();
