'use strict';

(function () {
  let count = 0;
  let started = 0;
  let ticker = null;

  function clearTapsTimers() {
    if (ticker !== null) { clearInterval(ticker); ticker = null; }
  }

  function init() {
    clearTapsTimers();
    count = 0;
    setState('idle', tr('눌러서 시작', 'Tap to start'), tr('10초 동안 많이 터치!', 'Tap fast for 10 seconds!'));
  }

  function finishTaps() {
    clearTapsTimers();
    saveBest('taps', count);
    showBest('taps');
    const result = tr(`10초 동안 ${count}회!`, `${count} taps in 10s!`);
    setState('idle', tr('다시 시작', 'Try again'), result);
  }

  function onAction() {
    const now = performance.now();
    if (state === 'playing') {
      if (now - started >= 10000) {
        finishTaps();
        return;
      }
      count++;
      $('#action').textContent = tr(`${count}회`, `${count} taps`);
    } else {
      count = 0;
      started = now;
      setState('playing', tr('0회', '0 taps'), tr('남은 시간 10초', '10 seconds left'));
      ticker = setInterval(() => {
        const remaining = 10000 - (performance.now() - started);
        if (remaining <= 0) {
          finishTaps();
        } else {
          $('#message').textContent = tr(`남은 시간 ${Math.ceil(remaining / 1000)}초`, `${Math.ceil(remaining / 1000)} seconds left`);
        }
      }, 100);
    }
  }

  function onCancel() {
    clearTapsTimers();
  }

  registerGame('taps', {
    init,
    onAction,
    onCancel
  });
})();
