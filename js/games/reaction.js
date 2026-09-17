'use strict';

(function () {
  let started = 0;
  let timer = null;

  function clearReactionTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function init() {
    clearReactionTimer();
    setState('idle', tr('눌러서 시작', 'Tap to start'), tr('초록색이 되면 터치!', 'Tap when green!'));
  }

  function onAction() {
    const now = performance.now();
    if (state === 'waiting') {
      clearReactionTimer();
      setState('idle', tr('다시 시작', 'Try again'), tr('너무 빨랐어요!', 'Too soon!'));
    } else if (state === 'ready') {
      const elapsed = Math.max(1, Math.round(now - started));
      saveBest('reaction', elapsed);
      showBest('reaction');
      setState('idle', tr('다시 시작', 'Try again'), `${elapsed} ms`);
    } else {
      setState('waiting', tr('기다려요', 'Wait…'), tr('초록색이 될 때까지…', 'Wait for green…'));
      timer = setTimeout(() => {
        started = performance.now();
        setState('ready', tr('지금!', 'NOW!'), tr('터치하세요!', 'Tap anywhere!'));
      }, 1500 + Math.random() * 2500);
    }
  }

  function onCancel() {
    clearReactionTimer();
  }

  registerGame('reaction', {
    init,
    onAction,
    onCancel
  });
})();
