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
  $('#best').textContent = best === null ? '최고 기록 —' : `최고 ${best} ${games[current].unit}`;
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
  current = Object.hasOwn(games, id) ? id : null;
  $('#menu').hidden = current !== null;
  $('#game').hidden = current === null;
  document.body.dataset.state = 'idle';
  state = 'idle';
  if (current) {
    $('#title').textContent = games[current].title;
    setState('idle', '눌러서 시작', games[current].help);
    showBest();
    play.focus({ preventScroll: true });
  }
}
function finishTaps() {
  clearTimers();
  saveBest(count);
  setState('idle', '다시 시작', `10초 동안 ${count}회!`);
}
play.addEventListener('click', () => {
  if (!current) return;
  const now = performance.now();
  if (current === 'reaction') {
    if (state === 'waiting') {
      clearTimers();
      setState('idle', '다시 시작', '너무 빨랐어요!');
    } else if (state === 'ready') {
      const elapsed = Math.max(1, Math.round(now - started));
      saveBest(elapsed);
      setState('idle', '다시 시작', `${elapsed} ms`);
    } else {
      setState('waiting', '기다려요', '초록색이 될 때까지…');
      timer = setTimeout(() => {
        started = performance.now();
        setState('ready', '지금!', '터치하세요!');
      }, 1500 + Math.random() * 2500);
    }
  } else if (current === 'taps') {
    if (state === 'playing') {
      if (now - started >= 10000) { finishTaps(); return; }
      count++;
      $('#action').textContent = `${count}회`;
    } else {
      count = 0;
      started = now;
      setState('playing', '0회', '남은 시간 10초');
      ticker = setInterval(() => {
        const remaining = 10000 - (performance.now() - started);
        if (remaining <= 0) finishTaps();
        else $('#message').textContent = `남은 시간 ${Math.ceil(remaining / 1000)}초`;
      }, 100);
    }
  } else if (state === 'playing') {
    const elapsed = Math.round(now - started);
    const error = Math.abs(elapsed - 5000);
    saveBest(error);
    setState('idle', '다시 시작', `${(elapsed / 1000).toFixed(2)}초 · 오차 ${error}ms`);
  } else {
    started = now;
    setState('playing', '지금 몇 초?', '5초가 되면 터치!');
  }
});
document.querySelectorAll('[data-game]').forEach(button => {
  button.addEventListener('click', () => { location.hash = button.dataset.game; });
});
$('#back').addEventListener('click', () => {
  location.hash = '';
});
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && current && state !== 'idle') {
    clearTimers();
    setState('idle', '다시 시작', '잠시 멈췄어요');
  }
});
route();
