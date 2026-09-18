'use strict';

let current = null;
let state = 'idle';
const play = $('#play');
let restartLockoutUntil = 0;
const RESTART_LOCKOUT_MS = 650;

function setState(next, label, text) {
  if (state !== 'idle' && next === 'idle') {
    restartLockoutUntil = performance.now() + RESTART_LOCKOUT_MS;
  } else if (next !== 'idle') {
    restartLockoutUntil = 0;
  }
  state = next;
  document.body.dataset.state = next;
  $('#message').hidden = false;
  $('#action').textContent = label;
  $('#message').textContent = text;
  play.setAttribute('aria-label', `${text} ${label}`);
}

function showBest(targetGame = current) {
  if (!targetGame || !games[targetGame]) return;
  const best = bestValue(targetGame);
  const unitStr = tr(
    games[targetGame].unit,
    { reaction: 'ms', taps: 'taps', timing: 'ms off', runner: 'pts', blackjack: '$' }[targetGame]
  );
  const displayUnit = targetGame === 'blackjack' ? '' : ` ${unitStr}`;
  const prefix = targetGame === 'blackjack' ? '$' : '';
  const label = targetGame === 'blackjack' ? tr('최고 기록', 'Best Record') : tr('최고', 'Best');
  const text = best === null
    ? tr('최고 기록 —', 'Best —')
    : `${label} ${prefix}${best}${displayUnit}`;

  const isRunner = targetGame === 'runner';
  $('#best').hidden = isRunner;
  $('#runner-best').textContent = text;
  $('#best').textContent = text;
}
window.updateGameBestDisplay = () => { if (current) showBest(current); };

function syncGameLanguage() {
  if (!current || !games[current]) return;
  $('#title').textContent = cards[current].title();
  showBest(current);
  if (state === 'idle') {
    gameModules[current]?.init?.();
  }
}
window.syncGameLanguage = syncGameLanguage;

function route() {
  const previous = current;
  const id = location.hash.slice(1);
  const settingsOpen = id === 'settings';

  if (previous && previous !== id) {
    gameModules[previous]?.onCancel?.();
  }

  current = Object.prototype.hasOwnProperty.call(games, id) ? id : null;

  $('#settings').hidden = !settingsOpen;
  $('#menu').hidden = current !== null || settingsOpen;

  if (current || settingsOpen) {
    selected = id;
  }
  if (window.renderMenu) window.renderMenu();
  if (!current && !settingsOpen) window.syncVisibleMenu?.();

  $('#game').hidden = current === null;
  document.body.dataset.state = 'idle';
  state = 'idle';

  const isBj = current === 'blackjack';
  const isRunner = current === 'runner';
  $('#blackjack-table').hidden = !isBj;
  $('#runner-stage').hidden = !isRunner;
  if (!isRunner) $('#best').hidden = false;
  if (!isBj) $('#bj-round-meta').hidden = true;
  $('#action').style.display = (isBj || isRunner) ? 'none' : '';
  play.style.display = isBj ? 'none' : '';

  if (current) {
    $('#title').textContent = cards[current].title();
    showBest(current);
    gameModules[current]?.init?.();
  }
}

// Global Play Controls Delegator
play.addEventListener('click', event => {
  if (!current) return;
  if (state === 'idle' && performance.now() < restartLockoutUntil) {
    event.preventDefault();
    return;
  }
  gameModules[current]?.onAction?.(event);
});

play.addEventListener('pointerdown', event => {
  if (!current) return;
  if (state === 'idle' && performance.now() < restartLockoutUntil) {
    event.preventDefault();
    return;
  }
  gameModules[current]?.onPointerDown?.(event);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
  play.addEventListener(type, event => {
    if (!current) return;
    gameModules[current]?.onPointerUp?.(event);
  });
});

window.addEventListener('keydown', event => {
  if (!current || location.hash === '#settings') return;

  // Escape 키: 게임 중 메뉴로 복귀
  if (event.key === 'Escape') {
    event.preventDefault();
    location.hash = '';
    return;
  }

  // 시스템 단축키는 브라우저 기본 동작 유지
  if (['F5', 'F12', 'Tab', 'Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) {
    return;
  }

  // 재시작 락아웃 검사
  if (state === 'idle' && performance.now() < restartLockoutUntil) {
    event.preventDefault();
    return;
  }

  const module = gameModules[current];
  if (!module) return;

  if (module.onKeyDown) {
    module.onKeyDown(event);
  } else if (module.onAction) {
    // onKeyDown이 없는 간단한 탭 게임(반응속도, 연타, 5초)은 아무 키나 누르면 액션 실행
    event.preventDefault();
    if (!event.repeat) {
      module.onAction(event);
    }
  }
});

window.addEventListener('keyup', event => {
  if (!current || location.hash === '#settings') return;
  gameModules[current]?.onKeyUp?.(event);
});

play.addEventListener('contextmenu', event => {
  if (current === 'runner') event.preventDefault();
});

$('#back').addEventListener('click', () => {
  location.hash = '';
});

window.addEventListener('hashchange', route);

window.addEventListener('resize', () => {
  if (current && gameModules[current]?.onResize) {
    requestAnimationFrame(() => {
      gameModules[current].onResize();
    });
  }
});

document.addEventListener('visibilitychange', () => {
  if (current && gameModules[current]?.onVisibilityChange) {
    gameModules[current].onVisibilityChange(document.hidden);
  } else if (document.hidden && current && state !== 'idle') {
    setState('idle', tr('다시 시작', 'Try again'), tr('잠시 멈췄어요', 'Round paused'));
  }
});

// Initial route
route();
