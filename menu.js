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
function renderMenu() {
  const ids = orderedCards();
  const index = ids.indexOf(selected);
  document.querySelector('#card-icon').textContent = cards[selected].icon;
  document.querySelector('#card-title').textContent = cards[selected].title();
  document.querySelector('#card-help').textContent = cards[selected].help();
  document.querySelector('#selected-card').setAttribute('aria-label', tr('열기: ', 'Open: ') + cards[selected].title());
  for (const [id, offset, arrow] of [['previous', -1, '‹'], ['next', 1, '›']]) {
    const button = document.querySelector('#' + id);
    const neighbor = ids[index + offset];
    button.disabled = !neighbor;
    button.textContent = neighbor ? arrow : '';
    button.setAttribute('aria-label', neighbor ? cards[neighbor].title() : tr('끝', 'End'));
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
  const ids = orderedCards();
  selected = ids[Math.max(0, Math.min(ids.length - 1, ids.indexOf(selected) + step))];
  renderMenu();
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
  favorites = favorites.includes(selected) ? favorites.filter(id => id !== selected) : [...favorites, selected];
  writePreference('watch-favorites', favorites);
  renderMenu();
});
const carousel = document.querySelector('#carousel');
let gesture = null;
let suppressClick = false;
carousel.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
window.addEventListener('pointerup', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  gesture = null;
  if (Math.abs(dx) >= 30 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    suppressClick = true;
    moveCard(dx < 0 ? 1 : -1);
  }
});
window.addEventListener('pointercancel', () => { gesture = null; });
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
