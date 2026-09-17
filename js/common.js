'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => document.querySelectorAll(selector);

function readPreference(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
}

function writePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

let language = readPreference('watch-language', 'ko');
if (!['ko', 'en'].includes(language)) language = 'ko';

let theme = readPreference('watch-theme', 'dark');
if (!['dark', 'light', 'system', 'contrast'].includes(theme)) theme = 'dark';

let favorites = readPreference('watch-favorites', []);
if (!Array.isArray(favorites)) favorites = [];
favorites = favorites.filter(id => ['reaction', 'taps', 'timing', 'runner', 'blackjack'].includes(id));

const tr = (ko, en) => language === 'ko' ? ko : en;

const recordKeys = [
  'watch-reaction-best',
  'watch-taps-best',
  'watch-timing-best',
  'watch-runner-best',
  'watch-blackjack-best'
];

const cards = {
  reaction: { icon: 'ϟ', title: () => tr('반응속도', 'Reaction'), help: () => tr('초록색이면 터치', 'Tap when green') },
  taps: { icon: '◎', title: () => tr('10초 연타', 'Tap Rush'), help: () => tr('10초 동안 빠르게', 'Tap fast for 10 seconds') },
  timing: { icon: '◷', title: () => tr('5초 맞추기', 'Five Seconds'), help: () => tr('나만의 시간 감각', 'Feel the five-second mark') },
  runner: { icon: '▲', title: () => tr('러너', 'Runner'), help: () => tr('짧게 점프 · 꾹 누르면 연속', 'Tap to jump · hold to repeat') },
  blackjack: { icon: '♠', title: () => tr('블랙잭', 'Blackjack'), help: () => tr('21에 가깝게', 'Get close to 21') },
  settings: { icon: '⚙', title: () => tr('설정', 'Settings'), help: () => tr('언어 · 화면 테마', 'Language · Theme') }
};

const games = {
  reaction: { title: '반응속도', help: '초록색이 되면 터치!', key: 'watch-reaction-best', unit: 'ms' },
  taps: { title: '10초 연타', help: '10초 동안 많이 터치!', key: 'watch-taps-best', unit: '회' },
  timing: { title: '5초 맞추기', help: '시작 후 5초에 터치!', key: 'watch-timing-best', unit: 'ms 오차' },
  runner: { title: '러너', help: '짧게 점프, 꾹 누르면 최고 점프 연속!', key: 'watch-runner-best', unit: '점' },
  blackjack: { title: '블랙잭', help: '21에 가깝게 맞춰보세요!', key: 'watch-blackjack-best', unit: '$' }
};

function orderedCards() {
  const all = ['reaction', 'taps', 'timing', 'runner', 'blackjack'];
  const favs = favorites.filter(id => all.includes(id));
  const rest = all.filter(id => !favs.includes(id));
  return [...favs, ...rest, 'settings'];
}

function bestValue(gameId) {
  const game = games[gameId];
  if (!game) return null;
  try {
    const raw = localStorage.getItem(game.key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) && value >= 0 ? value : null;
  } catch (_) { return null; }
}

function saveBest(gameId, value) {
  const game = games[gameId];
  if (!game) return false;
  const old = bestValue(gameId);
  const isBetter = old === null || (
    ['taps', 'runner', 'blackjack'].includes(gameId) ? value > old : value < old
  );
  if (isBetter) {
    try { localStorage.setItem(game.key, String(value)); } catch (_) {}
  }
  return isBetter;
}

// Game registry
const gameModules = {};
function registerGame(id, module) {
  gameModules[id] = module;
}
