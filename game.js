'use strict';
const $ = selector => document.querySelector(selector);
const play = $('#play');
const games = {
  reaction: { title: '반응속도', help: '초록색이 되면 터치!', key: 'watch-reaction-best', unit: 'ms' },
  taps: { title: '10초 연타', help: '10초 동안 많이 터치!', key: 'watch-taps-best', unit: '회' },
  timing: { title: '5초 맞추기', help: '시작 후 5초에 터치!', key: 'watch-timing-best', unit: 'ms 오차' }
};
let current = null;
let state = 'idle';
let timer;
let ticker;
let started = 0;
let count = 0;
function clearTimers() { clearTimeout(timer); clearInterval(ticker); }
function bestValue() {
  try {
    const raw = localStorage.getItem(games[current].key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) && value >= 0 ? value : null;
  } catch (_) { return null; }
}
function showBest() {
  const best = bestValue();
  const unit = tr(games[current].unit, { reaction: 'ms', taps: 'taps', timing: 'ms off' }[current]);
  $('#best').textContent = best === null ? tr('최고 기록 —', 'Best —') : `${tr('최고', 'Best')} ${best} ${unit}`;
}
function saveBest(value) {
  const old = bestValue();
  if (old === null || (current === 'taps' ? value > old : value < old)) {
    try { localStorage.setItem(games[current].key, String(value)); } catch (_) {}
  }
  showBest();
}
function setState(next, label, text) {
  state = next;
  document.body.dataset.state = next;
  $('#action').textContent = label;
  $('#message').textContent = text;
  play.setAttribute('aria-label', `${text} ${label}`);
}
function route() {
  clearTimers();
  const id = location.hash.slice(1);
  const settingsOpen = id === 'settings';
  $('#settings').hidden = !settingsOpen;
  current = Object.prototype.hasOwnProperty.call(games, id) ? id : null;
  $('#menu').hidden = current !== null || settingsOpen;
  if (current || settingsOpen) selected = id;
  renderMenu();
  $('#game').hidden = current === null;
  document.body.dataset.state = 'idle';
  state = 'idle';
  if (current) {
    $('#title').textContent = cards[current].title();
    setState('idle', tr('눌러서 시작', 'Tap to start'), tr(games[current].help, { reaction: 'Tap when green!', taps: 'Tap fast for 10 seconds!', timing: 'Tap again after 5 seconds!' }[current]));
    showBest();
    play.focus({ preventScroll: true });
  }
}
function finishTaps() {
  clearTimers();
  saveBest(count);
  setState('idle', tr('다시 시작', 'Try again'), tr(`10초 동안 ${count}회!`, `${count} taps in 10s!`));
}
play.addEventListener('click', () => {
  if (!current) return;
  const now = performance.now();
  if (current === 'reaction') {
    if (state === 'waiting') {
      clearTimers();
      setState('idle', tr('다시 시작', 'Try again'), tr('너무 빨랐어요!', 'Too soon!'));
    } else if (state === 'ready') {
      const elapsed = Math.max(1, Math.round(now - started));
      saveBest(elapsed);
      setState('idle', tr('다시 시작', 'Try again'), `${elapsed} ms`);
    } else {
      setState('waiting', tr('기다려요', 'Wait…'), tr('초록색이 될 때까지…', 'Wait for green…'));
      timer = setTimeout(() => {
        started = performance.now();
        setState('ready', tr('지금!', 'NOW!'), tr('터치하세요!', 'Tap anywhere!'));
      }, 1500 + Math.random() * 2500);
    }
  } else if (current === 'taps') {
    if (state === 'playing') {
      if (now - started >= 10000) { finishTaps(); return; }
      count++;
      $('#action').textContent = tr(`${count}회`, `${count} taps`);
    } else {
      count = 0;
      started = now;
      setState('playing', tr('0회', '0 taps'), tr('남은 시간 10초', '10 seconds left'));
      ticker = setInterval(() => {
        const remaining = 10000 - (performance.now() - started);
        if (remaining <= 0) finishTaps();
        else $('#message').textContent = tr(`남은 시간 ${Math.ceil(remaining / 1000)}초`, `${Math.ceil(remaining / 1000)} seconds left`);
      }, 100);
    }
  } else if (state === 'playing') {
    const elapsed = Math.round(now - started);
    const error = Math.abs(elapsed - 5000);
    saveBest(error);
    setState('idle', tr('다시 시작', 'Try again'), tr(`${(elapsed / 1000).toFixed(2)}초 · 오차 ${error}ms`, `${(elapsed / 1000).toFixed(2)}s · ${error}ms off`));
  } else {
    started = now;
    setState('playing', tr('지금 몇 초?', 'Five seconds?'), tr('5초가 되면 터치!', 'Tap at 5 seconds!'));
  }
});
$('#back').addEventListener('click', () => {
  location.hash = '';
});
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && current && state !== 'idle') {
    clearTimers();
    setState('idle', tr('다시 시작', 'Try again'), tr('잠시 멈췄어요', 'Round paused'));
  }
});
route();
