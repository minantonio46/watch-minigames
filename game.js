'use strict';
const $ = selector => document.querySelector(selector);
const play = $('#play');
const games = {
  reaction: { title: '반응속도', help: '초록색이 되면 터치!', key: 'watch-reaction-best', unit: 'ms' },
  taps: { title: '10초 연타', help: '10초 동안 많이 터치!', key: 'watch-taps-best', unit: '회' },
  timing: { title: '5초 맞추기', help: '시작 후 5초에 터치!', key: 'watch-timing-best', unit: 'ms 오차' },
  blackjack: { title: '블랙잭', help: '21에 가깝게 맞춰보세요!', key: 'watch-blackjack-best', unit: '$' }
};
let current = null;
let state = 'idle';
let timer;
let ticker;
let started = 0;
let count = 0;
let tapsRestartLocked = false;

// Blackjack state
let bjPlayer = [];
let bjDealer = [];
let bjDeck = [];
let bjMoney = 1000;
let maxBjMoney = 1000;
const BET_OPTIONS = [50, 100, 200, 500];
let bjBet = 100;
let bjState = 'idle';

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
  const unitStr = tr(games[current].unit, { reaction: 'ms', taps: 'taps', timing: 'ms off', blackjack: '$' }[current]);
  const displayUnit = current === 'blackjack' ? '' : ` ${unitStr}`;
  const prefix = current === 'blackjack' ? '$' : '';
  $('#best').textContent = best === null ? tr('최고 기록 —', 'Best —') : `${tr('최고', 'Best')} ${prefix}${best}${displayUnit}`;
}
function saveBest(value) {
  const old = bestValue();
  if (old === null || (['taps', 'blackjack'].includes(current) ? value > old : value < old)) {
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
  tapsRestartLocked = false;
  const id = location.hash.slice(1);
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
  $('#blackjack-table').hidden = !isBj;
  $('#action').style.display = isBj ? 'none' : '';
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
      $('#bj-new').textContent = tr('기록 후 새로하기', 'Record & restart');
      $('#bj-bet-down').setAttribute('aria-label', tr('판돈 줄이기', 'Lower bet'));
      $('#bj-bet-up').setAttribute('aria-label', tr('판돈 늘리기', 'Raise bet'));
      if (bjState === 'idle') {
        showBjSetup();
      }
    } else {
      setState('idle', tr('눌러서 시작', 'Tap to start'), tr(games[current].help, { reaction: 'Tap when green!', taps: 'Tap fast for 10 seconds!', timing: 'Tap again after 5 seconds!' }[current]));
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
    return `<span class="bj-card ${redClass}"><span class="bj-suit">${c.suit}</span><span class="bj-rank">${c.rank}</span></span>`;
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
  const affordable = BET_OPTIONS.filter(value => value <= bjMoney);
  if (affordable.length && !affordable.includes(bjBet)) bjBet = affordable[affordable.length - 1];
  $('#bj-bankroll').textContent = tr(`보유 $${bjMoney}`, `Bank $${bjMoney}`);
  $('#bj-bet').textContent = tr(`판돈 $${bjBet}`, `Bet $${bjBet}`);
  $('#bj-bet-down').disabled = !affordable.length || bjBet === affordable[0];
  $('#bj-bet-up').disabled = !affordable.length || bjBet === affordable[affordable.length - 1];
  $('#bj-deal').disabled = !affordable.length;
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
  $('#message').textContent = bjMoney > 0
    ? tr('판돈을 고른 뒤 게임을 시작하세요.', 'Choose a bet, then start.')
    : tr('보유금이 없습니다. 새로 시작하세요.', 'No money left. Start fresh.');
}

function adjustBjBet(direction) {
  const affordable = BET_OPTIONS.filter(value => value <= bjMoney);
  const index = affordable.indexOf(bjBet);
  if (index < 0) return;
  bjBet = affordable[Math.max(0, Math.min(affordable.length - 1, index + direction))];
  syncBjBet();
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
  $('#message').textContent = tr(`히트 또는 스탠드 ($${bjMoney})`, `Hit or Stand ($${bjMoney})`);

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
    $('#message').textContent = msg + ` ($${bjMoney})`;
  }

  showBest();
}
function finishTaps() {
  clearTimers();
  saveBest(count);
  const result = tr(`10초 동안 ${count}회!`, `${count} taps in 10s!`);
  tapsRestartLocked = true;
  setState('idle', tr('잠시만', 'One moment'), result);
  timer = setTimeout(() => {
    if (current !== 'taps' || state !== 'idle') return;
    tapsRestartLocked = false;
    setState('idle', tr('다시 시작', 'Try again'), result);
  }, 1000);
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
$('#bj-hit').addEventListener('click', bjHit);
$('#bj-stand').addEventListener('click', bjStand);
$('#bj-deal').addEventListener('click', startBlackjack);
$('#bj-continue').addEventListener('click', () => showBjSetup());
$('#bj-new').addEventListener('click', () => showBjSetup(true));
$('#bj-bet-down').addEventListener('click', () => adjustBjBet(-1));
$('#bj-bet-up').addEventListener('click', () => adjustBjBet(1));
route();
