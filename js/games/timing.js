'use strict';

(function () {
  let started = 0;

  function init() {
    setState('idle', tr('눌러서 시작', 'Tap to start'), tr('시작 후 5초에 터치!', 'Tap again after 5 seconds!'));
  }

  function onAction() {
    const now = performance.now();
    if (state === 'playing') {
      const elapsed = Math.round(now - started);
      const error = Math.abs(elapsed - 5000);
      saveBest('timing', error);
      showBest('timing');
      setState(
        'idle',
        tr('다시 시작', 'Try again'),
        tr(`${(elapsed / 1000).toFixed(2)}초 · 오차 ${error}ms`, `${(elapsed / 1000).toFixed(2)}s · ${error}ms off`)
      );
    } else {
      started = now;
      setState('playing', tr('지금 몇 초?', 'Five seconds?'), tr('5초가 되면 터치!', 'Tap at 5 seconds!'));
    }
  }

  function onCancel() {
    started = 0;
  }

  registerGame('timing', {
    init,
    onAction,
    onCancel
  });
})();
