'use strict';
const $ = selector => document.querySelector(selector);
const play = $('#play');
const games = {
  reaction: { title: '반응속도', help: '초록색이 되면 터치!', key: 'watch-reaction-best', unit: 'ms' },
  taps: { title: '10초 연타', help: '10초 동안 많이 터치!', key: 'watch-taps-best', unit: '회' },
  timing: { title: '5초 맞추기', help: '시작 후 5초에 터치!', key: 'watch-timing-best', unit: 'ms 오차' },
  runner: { title: '러너', help: '짧게 점프, 꾹 누르면 최고 점프 연속!', key: 'watch-runner-best', unit: '점' },
  blackjack: { title: '블랙잭', help: '21에 가깝게 맞춰보세요!', key: 'watch-blackjack-best', unit: '$' }
};
let current = null;
let state = 'idle';
let timer;
let ticker;
let started = 0;
let count = 0;
let tapsRestartLocked = false;
let runnerFrame = null;
let runnerRunning = false;
let runnerHolding = false;
let runnerPointerDown = false;
let runnerRestartArmed = true;
let runnerIgnoreNextClick = false;
let runnerY = 0;
let runnerVelocity = 0;
let runnerHoldMs = 0;
let runnerSpeed = 0;
let runnerScore = 0;
let runnerLastFrame = 0;
const runnerObstacleGlyphs = ['▣', '✚', '✖', '⌘', '※'];
const RUNNER_MAX_DIFFICULTY_SCORE = 500;
// Long, repeated glyphs can render beyond their measured box on watch browsers.
// Keep a fixed overscan that exceeds the largest possible rendered glyph run.
const RUNNER_GLYPH_OVERSCAN = 280;
let runnerObstacles = [];
let runnerAirObstacleCount = 0;
let runnerGroundObstacleCount = 0;

// Blackjack state
let bjPlayer = [];
let bjDealer = [];
let bjDeck = [];
let bjMoney = 1000;
let maxBjMoney = 1000;
const MIN_BJ_BET = 50;
let bjBet = 100;
let bjState = 'idle';

function clearTimers() { clearTimeout(timer); clearInterval(ticker); }
function stopRunner(hideObstacles = true) {
  if (runnerFrame !== null) cancelAnimationFrame(runnerFrame);
  runnerFrame = null;
  runnerRunning = false;
  runnerHolding = false;
  if (hideObstacles) $('#runner-stage')?.removeAttribute('data-running');
}
function resetRunnerPreview() {
  runnerScore = 0;
  runnerPointerDown = false;
  runnerRestartArmed = true;
  runnerIgnoreNextClick = false;
  $('#runner-score').textContent = '';
  $('#runner-player').style.transform = 'translateY(0)';
  $('#runner-obstacle').style.left = '0px';
  $('#runner-obstacle-next').style.left = '0px';
  $('#runner-obstacle-tail').style.left = '0px';
}
function hasActiveBlackjackRound() { return bjState === 'player' || bjState === 'dealer'; }
function cancelBlackjackRound() {
  bjState = 'idle';
}
function bestValue() {
  try {
    const raw = localStorage.getItem(games[current].key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) && value >= 0 ? value : null;
  } catch (_) { return null; }
}
function showBest() {
  const best = bestValue();
  const unitStr = tr(games[current].unit, { reaction: 'ms', taps: 'taps', timing: 'ms off', runner: 'pts', blackjack: '$' }[current]);
  const displayUnit = current === 'blackjack' ? '' : ` ${unitStr}`;
  const prefix = current === 'blackjack' ? '$' : '';
  const text = best === null ? tr('최고 기록 —', 'Best —') : `${tr('최고', 'Best')} ${prefix}${best}${displayUnit}`;
  const isRunner = current === 'runner';
  $('#best').hidden = isRunner;
  $('#runner-best').textContent = text;
  $('#best').textContent = text;
}
function saveBest(value) {
  const old = bestValue();
  if (old === null || (['taps', 'runner', 'blackjack'].includes(current) ? value > old : value < old)) {
    try { localStorage.setItem(games[current].key, String(value)); } catch (_) {}
  }
  showBest();
}
function setState(next, label, text) {
  state = next;
  document.body.dataset.state = next;
  $('#message').hidden = false;
  $('#action').textContent = label;
  $('#message').textContent = text;
  play.setAttribute('aria-label', `${text} ${label}`);
}
function route() {
  const previous = current;
  clearTimers();
  stopRunner();
  tapsRestartLocked = false;
  const id = location.hash.slice(1);
  if (previous === 'blackjack' && id !== 'blackjack') cancelBlackjackRound();
  const settingsOpen = id === 'settings';
  $('#settings').hidden = !settingsOpen;
  current = Object.prototype.hasOwnProperty.call(games, id) ? id : null;
  $('#menu').hidden = current !== null || settingsOpen;
  if (current || settingsOpen) selected = id;
  renderMenu();
  if (!current && !settingsOpen) window.syncVisibleMenu?.();
  $('#game').hidden = current === null;
  document.body.dataset.state = 'idle';
  state = 'idle';

  const isBj = current === 'blackjack';
  const isRunner = current === 'runner';
  $('#blackjack-table').hidden = !isBj;
  $('#runner-stage').hidden = !isRunner;
  if (!isRunner) $('#best').hidden = false;
  if (isRunner) resetRunnerPreview();
  if (!isBj) $('#bj-round-meta').hidden = true;
  $('#action').style.display = (isBj || isRunner) ? 'none' : '';
  play.style.display = isBj ? 'none' : '';

  if (current) {
    $('#title').textContent = cards[current].title();
    if (isBj) {
      $('#bj-dealer-label').textContent = tr('딜러', 'Dealer');
      $('#bj-player-label').textContent = tr('나', 'You');
      $('#bj-hit').textContent = tr('+ 히트', '+ Hit');
      $('#bj-stand').textContent = tr('스탠드', 'Stand');
      $('#bj-deal').textContent = tr('게임 시작', 'Start game');
      $('#bj-continue').textContent = tr('이어하기', 'Continue');
      $('#bj-new').textContent = tr('기록 후\n새로하기', 'Record & restart');
      $('#bj-bet-down').setAttribute('aria-label', tr('판돈 줄이기, 길게 눌러 최소 판돈', 'Lower bet; hold for minimum'));
      $('#bj-bet-up').setAttribute('aria-label', tr('판돈 늘리기, 길게 눌러 최대 판돈', 'Raise bet; hold for maximum'));
      if (bjState === 'idle') {
        showBjSetup();
      }
    } else {
      setState('idle', tr('눌러서 시작', 'Tap to start'), tr(games[current].help, { reaction: 'Tap when green!', taps: 'Tap fast for 10 seconds!', timing: 'Tap again after 5 seconds!', runner: 'Tap to jump; hold for continuous high jumps!' }[current]));
    }
    showBest();
  }
}

function createBjDeck() {
  const suits = [
    { s: '♠', red: false },
    { s: '♥', red: true },
    { s: '♦', red: true },
    { s: '♣', red: false }
  ];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      let val = parseInt(rank, 10);
      if (rank === 'A') val = 11;
      else if (['J', 'Q', 'K'].includes(rank)) val = 10;
      deck.push({ suit: suit.s, rank, val, isRed: suit.red });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawBjCard() {
  if (bjDeck.length < 8) bjDeck = createBjDeck();
  return bjDeck.pop();
}

function calcBjHand(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += c.val;
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function renderBjCards(container, hand, hideSecond = false) {
  container.innerHTML = hand.map((c, idx) => {
    if (hideSecond && idx === 1) {
      return `<span class="bj-card hidden" aria-label="${tr('숨김 카드', 'Hidden card')}">?</span>`;
    }
    const redClass = c.isRed ? 'red' : '';
    const rankClass = String(c.rank).length > 1 && idx < hand.length - 1 ? ' two-digit' : '';
    return `<span class="bj-card ${redClass}"><span class="bj-suit">${c.suit}</span><span class="bj-rank${rankClass}">${c.rank}</span></span>`;
  }).join('');
}

function updateBjUI(hideDealer = true) {
  const dealerCards = $('#bj-dealer-cards');
  const playerCards = $('#bj-player-cards');
  const dealerScore = $('#bj-dealer-score');
  const playerScore = $('#bj-player-score');

  renderBjCards(dealerCards, bjDealer, hideDealer);
  renderBjCards(playerCards, bjPlayer, false);

  const pScore = calcBjHand(bjPlayer);
  playerScore.textContent = String(pScore);

  if (hideDealer) {
    dealerScore.textContent = String(calcBjHand([bjDealer[0]]));
  } else {
    dealerScore.textContent = String(calcBjHand(bjDealer));
  }
}

function syncBjBet() {
  const maxBet = maxBjBet();
  if (maxBet && bjBet > maxBet) bjBet = maxBet;
  $('#bj-bankroll').textContent = tr(`보유 $${bjMoney}`, `Bank $${bjMoney}`);
  $('#bj-bet').textContent = tr(`판돈 $${bjBet}`, `Bet $${bjBet}`);
  $('#bj-bet-down').disabled = !maxBet || bjBet === MIN_BJ_BET;
  $('#bj-bet-up').disabled = !maxBet || bjBet === maxBet;
  $('#bj-deal').disabled = !maxBet;
}

function maxBjBet() {
  if (bjMoney < MIN_BJ_BET) return 0;
  if (bjMoney < 100) return MIN_BJ_BET;
  return Math.floor(bjMoney / 100) * 100;
}

function updateBjRoundMeta() {
  $('#bj-round-meta').textContent = tr(
    `보유 $${bjMoney} · 판돈 $${bjBet}`,
    `Bank $${bjMoney} · Bet $${bjBet}`
  );
}

function showBjSetup(resetBankroll = false) {
  if (resetBankroll) {
    saveBest(maxBjMoney);
    bjMoney = 1000;
    maxBjMoney = 1000;
    bjBet = 100;
  }
  bjState = 'idle';
  document.body.dataset.state = 'idle';
  $('#bj-dealer-cards').innerHTML = '';
  $('#bj-dealer-score').textContent = '';
  $('#bj-player-cards').innerHTML = '';
  $('#bj-player-score').textContent = '';
  $('#bj-round-meta').hidden = true;
  $('#bj-dealer-area').hidden = true;
  $('#bj-player-area').hidden = true;
  $('#bj-dealer-label').hidden = true;
  $('#bj-player-label').hidden = true;
  $('#bj-hit').hidden = true;
  $('#bj-stand').hidden = true;
  $('#bj-bet-controls').hidden = false;
  $('#bj-deal').hidden = false;
  $('#bj-continue').hidden = true;
  $('#bj-new').hidden = true;
  syncBjBet();
  $('#message').hidden = false;
  $('#message').textContent = bjMoney > 0
    ? tr('판돈을 고른 뒤 게임을 시작하세요.', 'Choose a bet, then start.')
    : tr('보유금이 없습니다. 새로 시작하세요.', 'No money left. Start fresh.');
}

function adjustBjBet(direction) {
  const maxBet = maxBjBet();
  if (!maxBet) return;
  if (direction < 0) {
    bjBet = bjBet <= 100 ? MIN_BJ_BET : bjBet - 100;
  } else {
    bjBet = bjBet === MIN_BJ_BET ? 100 : Math.min(maxBet, bjBet + 100);
  }
  syncBjBet();
}

function setBjBetExtreme(direction) {
  const maxBet = maxBjBet();
  if (!maxBet) return;
  bjBet = direction < 0 ? MIN_BJ_BET : maxBet;
  syncBjBet();
}

function bindBjBetStep(selector, direction) {
  const button = $(selector);
  let holdTimer;
  let longPressed = false;

  button.addEventListener('pointerdown', () => {
    longPressed = false;
    holdTimer = setTimeout(() => {
      longPressed = true;
      setBjBetExtreme(direction);
      navigator.vibrate?.(15);
    }, 450);
  });
  button.addEventListener('pointerup', () => clearTimeout(holdTimer));
  button.addEventListener('pointerleave', () => clearTimeout(holdTimer));
  button.addEventListener('pointercancel', () => {
    clearTimeout(holdTimer);
    longPressed = false;
  });
  button.addEventListener('click', () => {
    if (longPressed) {
      longPressed = false;
      return;
    }
    adjustBjBet(direction);
  });
  button.addEventListener('contextmenu', event => event.preventDefault());
}

function startBlackjack() {
  clearTimers();
  if (bjMoney < bjBet) return;

  bjMoney -= bjBet;
  bjDeck = createBjDeck();
  bjPlayer = [drawBjCard(), drawBjCard()];
  bjDealer = [drawBjCard(), drawBjCard()];
  bjState = 'player';
  document.body.dataset.state = 'idle';

  $('#bj-dealer-area').hidden = false;
  $('#bj-player-area').hidden = false;
  $('#bj-dealer-label').hidden = false;
  $('#bj-player-label').hidden = false;
  $('#bj-hit').hidden = false;
  $('#bj-stand').hidden = false;
  $('#bj-bet-controls').hidden = true;
  $('#bj-deal').hidden = true;
  $('#bj-continue').hidden = true;
  $('#bj-new').hidden = true;
  $('#bj-round-meta').hidden = false;
  updateBjRoundMeta();
  $('#message').hidden = true;

  updateBjUI(true);

  // Check initial natural Blackjack
  const pScore = calcBjHand(bjPlayer);
  const dScore = calcBjHand(bjDealer);

  if (pScore === 21) {
    if (dScore === 21) {
      endBlackjack('push');
    } else {
      endBlackjack('blackjack');
    }
  }
}

function bjHit() {
  if (bjState !== 'player') return;
  bjPlayer.push(drawBjCard());
  updateBjUI(true);

  const pScore = calcBjHand(bjPlayer);
  if (pScore > 21) {
    endBlackjack('bust');
  } else if (pScore === 21) {
    bjStand();
  }
}

function bjStand() {
  if (bjState !== 'player') return;
  bjState = 'dealer';

  $('#bj-hit').hidden = true;
  $('#bj-stand').hidden = true;
  updateBjUI(false); // Reveal dealer's hidden card first

  function drawNext() {
    const dealerTarget = calcBjHand(bjPlayer);
    if (calcBjHand(bjDealer) < dealerTarget) {
      bjDealer.push(drawBjCard());
      updateBjUI(false);
      timer = setTimeout(drawNext, 800);
    } else {
      const pScore = calcBjHand(bjPlayer);
      const dScore = calcBjHand(bjDealer);

      if (dScore > 21) {
        endBlackjack('dealer_bust');
      } else if (pScore > dScore) {
        endBlackjack('win');
      } else if (pScore < dScore) {
        endBlackjack('lose');
      } else {
        endBlackjack('push');
      }
    }
  }

  // Add a slight delay before dealer starts drawing for better effect
  timer = setTimeout(drawNext, 800);
}

function endBlackjack(outcome) {
  bjState = 'done';
  updateBjUI(false);
  $('#message').hidden = false;

  $('#bj-hit').hidden = true;
  $('#bj-stand').hidden = true;
  $('#bj-bet-controls').hidden = true;
  $('#bj-deal').hidden = true;
  $('#bj-continue').hidden = false;
  $('#bj-new').hidden = false;

  const pScore = calcBjHand(bjPlayer);
  const dScore = calcBjHand(bjDealer);

  let msg = '';

  if (outcome === 'blackjack') {
    bjMoney += Math.floor(bjBet * 2.5);
    document.body.dataset.state = 'ready';
    msg = tr(`블랙잭! 👑 승리`, `Blackjack! 👑 Win`);
  } else if (outcome === 'dealer_bust') {
    bjMoney += bjBet * 2;
    document.body.dataset.state = 'ready';
    msg = tr(`딜러 버스트(${dScore})! 🎉`, `Dealer bust(${dScore})! 🎉`);
  } else if (outcome === 'win') {
    bjMoney += bjBet * 2;
    document.body.dataset.state = 'ready';
    msg = tr(`승리! (${pScore} vs ${dScore})`, `Won! (${pScore} vs ${dScore})`);
  } else if (outcome === 'bust') {
    document.body.dataset.state = 'waiting';
    msg = tr(`버스트(${pScore})! 💥 패배`, `Bust(${pScore})! 💥 Loss`);
  } else if (outcome === 'lose') {
    document.body.dataset.state = 'waiting';
    msg = tr(`패배 (${pScore} vs ${dScore})`, `Dealer won (${pScore} vs ${dScore})`);
  } else if (outcome === 'push') {
    bjMoney += bjBet;
    document.body.dataset.state = 'idle';
    msg = tr(`비겼어요 (${pScore} = ${dScore})`, `Push (${pScore} = ${dScore})`);
  }

  if (bjMoney > maxBjMoney) maxBjMoney = bjMoney;
  saveBest(maxBjMoney);

  if (bjMoney <= 0) {
    $('#message').textContent = msg + ' - ' + tr('파산! 💸', 'Bankrupt! 💸');
    $('#bj-continue').hidden = true;
  } else {
    $('#message').textContent = msg;
  }

  updateBjRoundMeta();
  showBest();
}
function finishTaps() {
  clearTimers();
  saveBest(count);
  const result = tr(`10초 동안 ${count}회!`, `${count} taps in 10s!`);
  tapsRestartLocked = true;
  setState('idle', tr('숨 고르기!', 'Catch your breath!'), result);
  timer = setTimeout(() => {
    if (current !== 'taps' || state !== 'idle') return;
    tapsRestartLocked = false;
    setState('idle', tr('다시 시작', 'Try again'), result);
  }, 1000);
}
function runnerJump() {
  const stage = $('#runner-stage');
  const stageHeight = stage?.clientHeight || 155;
  const physicsScale = stageHeight / 155;
  if (!runnerRunning || runnerY > stageHeight * 0.006) return;
  runnerVelocity = 285 * physicsScale;
  runnerHoldMs = 0;
}
function renderRunner() {
  $('#runner-player').style.transform = `translateY(${-runnerY}px)`;
  runnerObstacles.forEach(obstacle => {
    obstacle.node.style.left = `${obstacle.x}px`;
  });
  $('#runner-score').textContent = tr(`${Math.floor(runnerScore)}점`, `${Math.floor(runnerScore)} pts`);
}
function buildRunnerObstacle(obstacle, stageWidth, stageHeight, x) {
  // Move off-screen before changing any visual property.  This avoids a frame
  // where a recycled obstacle briefly shows its new glyph at its old position.
  obstacle.x = x;
  obstacle.node.style.left = `${x}px`;
  obstacle.node.style.transform = 'none';
  obstacle.node.textContent = obstacle.node.textContent.charAt(0) || '▣';

  const difficulty = Math.min(1, runnerScore / RUNNER_MAX_DIFFICULTY_SCORE);
  const roll = Math.random();
  let kind = 'low';
  const canSpawnAir = runnerAirObstacleCount < runnerGroundObstacleCount * 2;
  if (difficulty > 0.14 && canSpawnAir && roll < 0.15 + difficulty * 0.08) kind = 'air';
  else if (difficulty > 0.18 && roll < 0.24 + difficulty * 0.12) kind = 'tall';
  else if (difficulty > 0.28 && roll < 0.44 + difficulty * 0.18) kind = 'wide';
  else if (roll > 0.66 - difficulty * 0.15) kind = 'quick';

  const specs = {
    low: { height: 0.16 + difficulty * 0.05, width: 0.09 + difficulty * 0.03, entry: 0.72, recovery: 0.96 },
    quick: { height: 0.13 + difficulty * 0.04, width: 0.08, entry: 0.78, recovery: 0.88 },
    air: { height: 0.13 + difficulty * 0.02, width: 0.12, bottom: 0.23 + difficulty * 0.02, entry: 0.90, recovery: 0.94 },
    tall: { height: 0.34 + difficulty * 0.12, width: 0.10, entry: 1.04, recovery: 1.26 },
    wide: { height: 0.18 + difficulty * 0.05, width: 0.30 + difficulty * 0.12, entry: 1.10, recovery: 1.34 }
  }[kind];
  const airRepeats = kind === 'air'
    ? (difficulty > 0.35 && Math.random() < 0.28 ? 4 : (Math.random() < 0.55 ? 2 : 1))
    : null;
  if (kind === 'air') {
    specs.entry = airRepeats === 4 ? 1.12 : specs.entry;
    specs.recovery = airRepeats === 4 ? 1.20 : specs.recovery;
  }
  obstacle.kind = kind;
  obstacle.height = Math.max(22, stageHeight * specs.height);
  obstacle.width = Math.max(24, stageWidth * specs.width);
  obstacle.bottom = stageHeight * (specs.bottom ?? 0);
  obstacle.entrySeconds = specs.entry;
  obstacle.recoverySeconds = specs.recovery;
  obstacle.repeatCount = airRepeats;
  if (kind === 'air') runnerAirObstacleCount++;
  else runnerGroundObstacleCount++;
  const fontSize = Math.max(26, obstacle.height * 1.25);
  // 1) move right, 2) collapse to one glyph, 3) size, 4) glyph,
  // 5) vertical position, 6) repeat count.
  obstacle.node.style.width = `${obstacle.width}px`;
  obstacle.node.style.height = '';
  obstacle.node.style.fontSize = `${fontSize}px`;
  const glyph = runnerObstacleGlyphs[Math.floor(Math.random() * runnerObstacleGlyphs.length)];
  obstacle.node.textContent = glyph;
  obstacle.node.style.bottom = `${obstacle.bottom}px`;
  if (kind === 'air') {
    // Air obstacles use the same single, horizontal run model as ground
    // obstacles: one glyph repeated 1, 2, or 4 times as one obstacle.
    obstacle.width = fontSize * 0.92 * airRepeats;
    obstacle.node.style.width = `${obstacle.width}px`;
    obstacle.node.style.letterSpacing = '';
    obstacle.node.textContent = glyph.repeat(airRepeats);
  } else {
    obstacle.node.classList.remove('air-bundle');
    const repeatCount = Math.max(1, Math.round(obstacle.width / (fontSize * 0.68)));
    obstacle.node.style.letterSpacing = '';
    obstacle.node.textContent = glyph.repeat(repeatCount);
  }
}
function endRunner() {
  stopRunner(false);
  runnerRestartArmed = !runnerPointerDown;
  const score = Math.floor(runnerScore);
  saveBest(score);
  setState('idle', tr('다시 달리기', 'Run again'), tr(`${score}점! 탭해서 다시 시작`, `${score} pts! Tap to run again`));
}
function runRunner(frameTime) {
  if (!runnerRunning || current !== 'runner') return;
  const elapsed = Math.min(40, frameTime - runnerLastFrame) / 1000;
  runnerLastFrame = frameTime;
  const stage = $('#runner-stage');
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) { runnerFrame = requestAnimationFrame(runRunner); return; }
  // Physics uses the same stage-height basis as the rendered runner. Without
  // this, a larger watch frame enlarged the cursor and obstacles but left the
  // jump arc at its old pixel height.
  const physicsScale = height / 155;
  if (runnerHolding && runnerVelocity > 0 && runnerHoldMs < 220) {
    runnerVelocity += 680 * physicsScale * elapsed;
    runnerHoldMs += elapsed * 1000;
  }
  runnerVelocity -= 850 * physicsScale * elapsed;
  runnerY += runnerVelocity * elapsed;
  if (runnerY <= 0) {
    runnerY = 0;
    runnerVelocity = 0;
    if (runnerHolding) runnerJump();
  }
  const difficulty = Math.min(1, runnerScore / RUNNER_MAX_DIFFICULTY_SCORE);
  const endlessSpeedBonus = Math.log1p(Math.max(0, runnerScore - RUNNER_MAX_DIFFICULTY_SCORE) / 500) * 0.05;
  // Preserve the same acceleration ratio while giving every obstacle more
  // on-screen reading time. No obstacle-specific slowdowns interrupt the flow.
  runnerSpeed = width * (0.44 + difficulty * 0.76 + endlessSpeedBonus);
  runnerScore += elapsed * 10;
  // Obstacles use their full visible box.  Only the cursor gets a forgiving,
  // inset hitbox so near misses feel fair without softening obstacle edges.
  const frameSize = Math.min(window.innerWidth, window.innerHeight);
  const playerVisualSize = frameSize * 0.065;
  const playerX = width * 0.12 + playerVisualSize * 0.12;
  const playerWidth = playerVisualSize * 0.62;
  runnerObstacles.forEach(obstacle => { obstacle.x -= runnerSpeed * elapsed; });
  const playerBottom = runnerY + playerVisualSize * 0.20;
  const playerTop = runnerY + playerVisualSize * 0.58;
  const hit = runnerObstacles.some(obstacle => {
    const hitBoxIntersects = (left, bottom, boxWidth, boxHeight) => {
      const horizontalHit = left < playerX + playerWidth && left + boxWidth > playerX;
      const verticalHit = playerTop > bottom && playerBottom < bottom + boxHeight;
      return horizontalHit && verticalHit;
    };
    return hitBoxIntersects(obstacle.x, obstacle.bottom, obstacle.width, obstacle.height);
  });
  if (hit) {
    endRunner();
    return;
  }
  runnerObstacles.forEach(obstacle => {
    if (obstacle.x + obstacle.width >= -RUNNER_GLYPH_OVERSCAN) return;
    const previous = runnerObstacles.filter(item => item !== obstacle).reduce((furthest, item) => (
      item.x + item.width > furthest.x + furthest.width ? item : furthest
    ));
    const stagingX = width + RUNNER_GLYPH_OVERSCAN;
    buildRunnerObstacle(obstacle, width, height, stagingX);
    const safeGap = runnerSpeed * Math.max(previous.recoverySeconds, obstacle.entrySeconds);
    obstacle.x = Math.max(stagingX, previous.x + previous.width + safeGap);
    obstacle.node.style.left = `${obstacle.x}px`;
  });
  renderRunner();
  runnerFrame = requestAnimationFrame(runRunner);
}
function startRunner() {
  const stage = $('#runner-stage');
  const width = stage.clientWidth;
  if (!width) return;
  stage.dataset.running = 'true';
  runnerRunning = true;
  runnerRestartArmed = false;
  runnerHolding = false;
  runnerY = 0;
  runnerVelocity = 0;
  runnerHoldMs = 0;
  runnerSpeed = width * 0.44;
  runnerScore = 0;
  runnerAirObstacleCount = 0;
  runnerGroundObstacleCount = 0;
  runnerLastFrame = performance.now();
  runnerObstacles = [
    { node: $('#runner-obstacle') },
    { node: $('#runner-obstacle-next') },
    { node: $('#runner-obstacle-tail') }
  ];
  // The first obstacle enters within 0.75 seconds; two further obstacles stay
  // queued so no empty stage is exposed while a recycled node is off-screen.
  const entryX = width + Math.min(96, runnerSpeed * 0.7);
  const stagingX = width + RUNNER_GLYPH_OVERSCAN;
  buildRunnerObstacle(runnerObstacles[0], width, stage.clientHeight, entryX);
  buildRunnerObstacle(runnerObstacles[1], width, stage.clientHeight, stagingX);
  runnerObstacles[1].x = runnerObstacles[0].x + runnerObstacles[0].width + runnerSpeed * Math.max(runnerObstacles[0].recoverySeconds, runnerObstacles[1].entrySeconds);
  runnerObstacles[1].node.style.left = `${runnerObstacles[1].x}px`;
  buildRunnerObstacle(runnerObstacles[2], width, stage.clientHeight, stagingX);
  runnerObstacles[2].x = runnerObstacles[1].x + runnerObstacles[1].width + runnerSpeed * Math.max(runnerObstacles[1].recoverySeconds, runnerObstacles[2].entrySeconds);
  runnerObstacles[2].node.style.left = `${runnerObstacles[2].x}px`;
  $('#message').textContent = tr('짧게: 낮은 점프 · 꾹: 최고 점프 연속', 'Tap: low jump · Hold: repeat high jumps');
  state = 'playing';
  document.body.dataset.state = 'idle';
  renderRunner();
  runnerFrame = requestAnimationFrame(runRunner);
}
play.addEventListener('click', () => {
  if (!current) return;
  if (current === 'runner') {
    if (runnerIgnoreNextClick) {
      runnerIgnoreNextClick = false;
      return;
    }
    if (!runnerRunning && runnerRestartArmed) startRunner();
    return;
  }
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
      if (tapsRestartLocked) return;
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
play.addEventListener('pointerdown', event => {
  if (current !== 'runner') return;
  event.preventDefault();
  runnerPointerDown = true;
  if (!runnerRunning) {
    if (runnerRestartArmed) startRunner();
  }
  else {
    runnerHolding = true;
    runnerJump();
  }
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(type => play.addEventListener(type, () => {
  if (current !== 'runner') return;
  runnerPointerDown = false;
  runnerHolding = false;
  if (!runnerRunning) {
    runnerRestartArmed = true;
    runnerIgnoreNextClick = true;
  }
}));
play.addEventListener('keydown', event => {
  if (current !== 'runner' || !runnerRunning || ![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  if (event.repeat) return;
  runnerHolding = true;
  runnerJump();
});
play.addEventListener('keyup', event => {
  if (current !== 'runner' || ![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  runnerHolding = false;
});
$('#back').addEventListener('click', () => {
  location.hash = '';
});
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && current === 'blackjack' && hasActiveBlackjackRound()) {
    clearTimers();
    cancelBlackjackRound();
    showBjSetup();
    return;
  }
  if (document.hidden && current && state !== 'idle') {
    clearTimers();
    stopRunner();
    setState('idle', tr('다시 시작', 'Try again'), tr('잠시 멈췄어요', 'Round paused'));
  }
});
$('#bj-hit').addEventListener('click', bjHit);
$('#bj-stand').addEventListener('click', bjStand);
$('#bj-deal').addEventListener('click', startBlackjack);
$('#bj-continue').addEventListener('click', () => showBjSetup());
$('#bj-new').addEventListener('click', () => showBjSetup(true));
bindBjBetStep('#bj-bet-down', -1);
bindBjBetStep('#bj-bet-up', 1);
route();
