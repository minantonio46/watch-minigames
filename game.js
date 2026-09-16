'use strict';
const play = document.querySelector('#play');
const message = document.querySelector('#message');
const bestLabel = document.querySelector('#best');
let state = 'idle';
let timer;
let readyAt = 0;
let best = Infinity;
try {
  const saved = Number(localStorage.getItem('watch-reaction-best'));
  if (saved > 0 && Number.isFinite(saved)) best = saved;
} catch (_) { /* Storage may be unavailable in private browsing. */ }
function showBest() {
  bestLabel.textContent = Number.isFinite(best) ? `최고 기록 ${best} ms` : '최고 기록 —';
}
function setState(next, label, text) {
  state = next;
  play.dataset.state = next;
  play.textContent = label;
  message.textContent = text;
}
play.addEventListener('click', () => {
  if (state === 'waiting') {
    clearTimeout(timer);
    setState('idle', '다시 시작', '너무 빨랐어요!');
  } else if (state === 'ready') {
    const elapsed = Math.max(1, Math.round(performance.now() - readyAt));
    if (elapsed < best) {
      best = elapsed;
      try { localStorage.setItem('watch-reaction-best', String(best)); } catch (_) {}
      showBest();
    }
    setState('idle', '다시 시작', `${elapsed} ms`);
  } else {
    setState('waiting', '기다려요', '초록색이 될 때까지…');
    timer = setTimeout(() => {
      readyAt = performance.now();
      setState('ready', '지금!', '터치하세요!');
    }, 1500 + Math.random() * 2500);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state !== 'idle') {
    clearTimeout(timer);
    setState('idle', '다시 시작', '잠시 멈췄어요');
  }
});
showBest();
