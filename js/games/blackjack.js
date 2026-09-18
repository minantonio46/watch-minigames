'use strict';

(function () {
  let bjPlayer = [];
  let bjDealer = [];
  let bjDeck = [];
  let bjMoney = 1000;
  const MIN_BJ_BET = 50;
  let bjBet = 100;
  let bjState = 'idle';
  let timer = null;

  function clearBjTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function hasActiveRound() {
    return bjState === 'player' || bjState === 'dealer';
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

  function isNaturalBlackjack(hand) {
    return hand.length === 2 && calcBjHand(hand) === 21;
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
    const dealerArea = $('#bj-dealer-area');
    const playerArea = $('#bj-player-area');
    const dealerCards = $('#bj-dealer-cards');
    const playerCards = $('#bj-player-cards');
    const dealerScore = $('#bj-dealer-score');
    const playerScore = $('#bj-player-score');

    if (dealerArea) dealerArea.style.setProperty('--cards-count', bjDealer.length || 2);
    if (playerArea) playerArea.style.setProperty('--cards-count', bjPlayer.length || 2);

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

  function maxBjBet() {
    if (bjMoney < MIN_BJ_BET) return 0;
    if (bjMoney < 100) return MIN_BJ_BET;
    return Math.floor(bjMoney / 100) * 100;
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

  function updateBjRoundMeta() {
    $('#bj-round-meta').textContent = tr(
      `보유 $${bjMoney} · 판돈 $${bjBet}`,
      `Bank $${bjMoney} · Bet $${bjBet}`
    );
  }

  function showBjSetup(resetBankroll = false) {
    if (resetBankroll) {
      // 자의적으로 '기록 후 새로하기'를 누른 시점의 최종 보유금액을 최고기록으로 남김
      if (bjMoney > 0) {
        saveBest('blackjack', bjMoney);
        showBest('blackjack');
      }
      bjMoney = 1000;
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
    let holdTimer = null;
    let isLongPress = false;
    let pressStartTime = 0;

    function clearHold() {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }

    button.addEventListener('pointerdown', (e) => {
      if (button.disabled) return;
      isLongPress = false;
      pressStartTime = performance.now();
      clearHold();

      // 워치 터치 딜레이를 고려하여 500ms 이상 길게 누를 때만 롱프레스(최소/최대) 발동
      holdTimer = setTimeout(() => {
        isLongPress = true;
        holdTimer = null;
        setBjBetExtreme(direction);
      }, 500);
    });

    button.addEventListener('pointerup', () => {
      clearHold();
    });

    button.addEventListener('pointercancel', () => {
      clearHold();
    });

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      clearHold();
      // 롱프레스가 발동되었거나 500ms 이상 눌려있었다면 일반 탭 동작 무시
      if (isLongPress || (pressStartTime && performance.now() - pressStartTime >= 500)) {
        isLongPress = false;
        return;
      }
      adjustBjBet(direction);
    });

    button.addEventListener('contextmenu', event => event.preventDefault());
  }

  function startBlackjack() {
    clearBjTimer();
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

    const playerNatural = isNaturalBlackjack(bjPlayer);
    const dealerNatural = isNaturalBlackjack(bjDealer);
    if (playerNatural) {
      if (dealerNatural) endBlackjack('push');
      else endBlackjack('blackjack');
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
    updateBjUI(false);

    if (isNaturalBlackjack(bjDealer)) {
      endBlackjack('dealer_blackjack');
      return;
    }

    timer = setTimeout(continueBjDealerTurn, 650);
  }

  function continueBjDealerTurn() {
    if (current !== 'blackjack' || bjState !== 'dealer') return;
    const dealerScore = calcBjHand(bjDealer);

    // If dealer busted, player wins immediately
    if (dealerScore > 21) {
      endBlackjack('dealer_bust');
      return;
    }

    // Dealer must hit on 16 and below
    if (dealerScore < 17) {
      bjDealer.push(drawBjCard());
      updateBjUI(false);
      timer = setTimeout(continueBjDealerTurn, 650);
      return;
    }

    // Dealer stands on 17-21; compare with player score
    const playerScore = calcBjHand(bjPlayer);
    if (playerScore > dealerScore) endBlackjack('win');
    else if (playerScore < dealerScore) endBlackjack('lose');
    else endBlackjack('push');
  }

  let bjRestartLockoutUntil = 0;
  const BJ_RESTART_LOCKOUT_MS = 650;

  function endBlackjack(outcome) {
    bjState = 'done';
    bjRestartLockoutUntil = performance.now() + BJ_RESTART_LOCKOUT_MS;
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
    } else if (outcome === 'dealer_blackjack') {
      document.body.dataset.state = 'waiting';
      msg = tr('딜러 블랙잭! 패배', 'Dealer blackjack! Loss');
    } else if (outcome === 'push') {
      bjMoney += bjBet;
      document.body.dataset.state = 'idle';
      msg = tr(`비겼어요 (${pScore} = ${dScore})`, `Push (${pScore} = ${dScore})`);
    }

    if (bjMoney <= 0) {
      $('#message').textContent = msg + ' - ' + tr('파산! 💸', 'Bankrupt! 💸');
      $('#bj-continue').hidden = true;
      $('#bj-new').textContent = tr('새로 시작', 'Start fresh');
    } else {
      $('#message').textContent = msg;
      $('#bj-new').textContent = tr('기록 후\n새로하기', 'Record &\nrestart');
    }

    updateBjRoundMeta();
    showBest('blackjack');
  }

  function init() {
    $('#bj-dealer-label').textContent = tr('딜러', 'Dealer');
    $('#bj-player-label').textContent = tr('나', 'You');
    $('#bj-hit').textContent = tr('+ 히트', '+ Hit');
    $('#bj-stand').textContent = tr('스탠드', 'Stand');
    $('#bj-deal').textContent = tr('게임 시작', 'Start game');
    $('#bj-continue').textContent = tr('이어하기', 'Continue');
    $('#bj-new').textContent = tr('기록 후\n새로하기', 'Record &\nrestart');
    $('#bj-bet-down').setAttribute('aria-label', tr('판돈 줄이기, 길게 눌러 최소 판돈', 'Lower bet; hold for minimum'));
    $('#bj-bet-up').setAttribute('aria-label', tr('판돈 늘리기, 길게 눌러 최대 판돈', 'Raise bet; hold for maximum'));
    if (bjState === 'idle') {
      showBjSetup();
    }
  }

  function onCancel() {
    clearBjTimer();
    bjState = 'idle';
  }

  function onVisibilityChange(isHidden) {
    if (isHidden && hasActiveRound()) {
      clearBjTimer();
      return;
    }
    if (!isHidden && bjState === 'dealer') {
      clearBjTimer();
      timer = setTimeout(continueBjDealerTurn, 350);
    }
  }

  function onKeyDown(event) {
    // 1. 베팅 상태 (시작 전)
    if (bjState === 'idle') {
      if (['ArrowUp', 'ArrowRight', '+', '='].includes(event.key)) {
        event.preventDefault();
        adjustBjBet(1);
      } else if (['ArrowDown', 'ArrowLeft', '-', '_'].includes(event.key)) {
        event.preventDefault();
        adjustBjBet(-1);
      } else if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        startBlackjack();
      }
      return;
    }

    // 2. 플레이어 턴 (히트 / 스탠드)
    if (bjState === 'player') {
      if (['Enter', ' ', 'h', 'H', 'ArrowUp', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        bjHit();
      } else if (['s', 'S', 'ArrowDown', 'ArrowLeft'].includes(event.key)) {
        event.preventDefault();
        bjStand();
      }
      return;
    }

    // 3. 라운드 종료 상태 (이어하기 / 새로하기)
    if (bjState === 'done') {
      if (performance.now() < bjRestartLockoutUntil) return;
      if (['Enter', ' ', 'c', 'C', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        showBjSetup();
      } else if (['n', 'N', 'r', 'R', 'Delete', 'Backspace'].includes(event.key)) {
        event.preventDefault();
        showBjSetup(true);
      }
    }
  }

  // Button Listeners
  $('#bj-hit').addEventListener('click', bjHit);
  $('#bj-stand').addEventListener('click', bjStand);
  $('#bj-deal').addEventListener('click', startBlackjack);
  $('#bj-continue').addEventListener('click', () => {
    if (performance.now() < bjRestartLockoutUntil) return;
    showBjSetup();
  });
  $('#bj-new').addEventListener('click', () => {
    if (performance.now() < bjRestartLockoutUntil) return;
    showBjSetup(true);
  });
  bindBjBetStep('#bj-bet-down', -1);
  bindBjBetStep('#bj-bet-up', 1);

  registerGame('blackjack', {
    init,
    onCancel,
    onVisibilityChange,
    onKeyDown
  });
})();
