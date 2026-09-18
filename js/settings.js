'use strict';

const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let resetRecordsTrigger = null;

function applyTheme() {
  const resolved = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  const metaTheme = $('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = resolved === 'light' ? '#f3f6fb' : '#000000';
  syncSettingChoices();
  if (window.applyMenuTween) window.applyMenuTween();
}

if (systemTheme.addEventListener) {
  systemTheme.addEventListener('change', applyTheme);
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = tr('워치 미니게임', 'Watch Minigames');
  $('#site-title').textContent = document.title;
  $('#settings-title').textContent = tr('설정', 'Settings');
  $('#language-label').textContent = tr('언어', 'Language');
  $('#theme-label').textContent = tr('화면 테마', 'Theme');
  $('#contrast-note').textContent = tr('검정 배경으로 OLED 전력을 아끼는 고대비 모드', 'High contrast with an OLED-saving black background');
  $('#guide-label').textContent = tr('도움말', 'Guide');
  $('#open-guide').textContent = tr('📖 게임별 가이드 & 조작법', '📖 Game Guide & Controls');
  $('#guide-modal-title').textContent = tr('게임 가이드', 'Game Guide');
  $('#guide-prev')?.setAttribute('aria-label', tr('이전 게임', 'Previous game'));
  $('#guide-next')?.setAttribute('aria-label', tr('다음 게임', 'Next game'));
  $('#guide-close-label').textContent = tr('설정', 'Settings');
  $('#guide-summary-label').textContent = tr('게임 개요', 'Overview');
  $('#guide-touch-label').textContent = tr('모바일 조작', 'Mobile Controls');
  $('#guide-keyboard-label').textContent = tr('PC 키보드 조작', 'PC Keyboard');
  $('#guide-tips-label').textContent = tr('공략 팁 & 규칙', 'Tips & Rules');
  $('#records-label').textContent = tr('기록', 'Records');
  $('#reset-records').textContent = tr('최고 기록 초기화', 'Reset best records');
  $('#reset-records-warning').textContent = tr('모든 최고 기록을 지울까요? 이 작업은 되돌릴 수 없어요.', 'Clear all best records? This cannot be undone.');
  $('#reset-records-cancel').textContent = tr('취소', 'Cancel');
  $('#reset-records-confirm-button').textContent = tr('초기화', 'Reset');
  $$('.choice-label').forEach(label => {
    label.textContent = label.dataset[language];
  });
  $('#back-label').textContent = tr('메뉴', 'Menu');
  $('#back').setAttribute('aria-label', tr('메뉴로 돌아가기', 'Return to menu'));
  $('#settings-back-label').textContent = tr('메뉴', 'Menu');
  $('#settings-back').setAttribute('aria-label', tr('메뉴로 돌아가기', 'Return to menu'));
  $('#game').setAttribute('aria-label', tr('게임', 'Game'));
  $('#carousel').setAttribute('aria-label', tr('게임 선택', 'Choose a game'));
  if (window.renderMenu) window.renderMenu();
  if (window.syncGameLanguage) window.syncGameLanguage();
  syncSettingChoices();
  if (currentGuideGame) renderGuideDetails(currentGuideGame);
}

let currentGuideGame = 'reaction';
let guideModalTrigger = null;

const GUIDE_GAMES = ['reaction', 'taps', 'timing', 'runner', 'blackjack'];

const guideData = {
  reaction: {
    icon: 'ϟ',
    shortTitle: () => tr('반응속도', 'Reaction'),
    title: () => tr('반응속도', 'Reaction Time'),
    summary: () => tr('화면이 초록색으로 바뀌는 순간 최대한 빠르게 반응하여 터치하는 순발력 게임입니다.', 'Test your reflexes by tapping as fast as possible the moment the screen turns green.'),
    touch: () => tr('화면 아무 곳이나 가볍게 한 번 터치합니다.', 'Tap anywhere on the screen when green appears.'),
    keyboard: () => tr('키보드의 아무 키(스페이스, 엔터, 문자키 등)나 가볍게 누릅니다.', 'Press any key (Space, Enter, letter keys, etc.).'),
    tips: () => tr('화면이 초록색으로 바뀌기 전에 먼저 누르면 "너무 빨랐어요!" 경고와 함께 실격 처리됩니다.', 'Tapping before the screen turns green triggers a "Too soon!" penalty and cancels the round.')
  },
  taps: {
    icon: '◎',
    shortTitle: () => tr('10초 연타', '10s Tap'),
    title: () => tr('10초 연타', '10s Speed Tap'),
    summary: () => tr('10초의 제한 시간 동안 화면을 최대한 많이 연속으로 터치하는 속도전 게임입니다.', 'Tap as many times as possible within a strict 10-second time limit.'),
    touch: () => tr('검지와 중지 두 손가락을 번갈아가며 빠르게 두드리면 훨씬 높은 점수를 얻을 수 있습니다.', 'Alternating between two fingers (index & middle) allows much faster tapping.'),
    keyboard: () => tr('키보드의 아무 키나 빠른 리듬으로 연속 연타합니다.', 'Rapidly mash any keyboard key in a steady rhythm.'),
    tips: () => tr('초반에 너무 힘을 주지 말고 10초 끝까지 일정한 페이스를 유지하는 것이 고득점의 비결입니다.', 'Pace yourself consistently rather than burning out in the first 3 seconds.')
  },
  timing: {
    icon: '◷',
    shortTitle: () => tr('5초 맞추기', '5s Sense'),
    title: () => tr('5초 맞추기', '5-Second Sense'),
    summary: () => tr('타이머를 보지 않고 마음속 감각만으로 정확히 5.000초 시점에 멈추는 직관 감각 게임입니다.', 'Stop the hidden timer as close to exactly 5.000 seconds as possible using pure intuition.'),
    touch: () => tr('화면을 터치해 시작하고, 마음속으로 5초가 되었다고 느낄 때 다시 화면을 터치합니다.', 'Tap to start, then tap again when you feel exactly 5 seconds have passed.'),
    keyboard: () => tr('아무 키나 눌러 타이머를 시작하고, 5초 시점에 다시 아무 키나 누릅니다.', 'Press any key to start, and press any key again at 5.000s.'),
    tips: () => tr('마음속으로 시계 초침 소리를 상상하거나 1부터 5까지 균일한 템포로 세어보세요. 오차가 0에 가까울수록 최고 기록입니다.', 'Count in a steady cadence like "one thousand one, one thousand two...". Lower error margin is better!')
  },
  runner: {
    icon: '[>]',
    shortTitle: () => tr('러너', 'Runner'),
    title: () => tr('러너', 'Runner'),
    summary: () => tr('오른쪽에서 쉼 없이 달려오는 지상과 공중의 다양한 장애물들을 뛰어넘으며 멀리 달리는 아케이드 게임입니다.', 'Dodge procedurally generated ground and airborne obstacles to survive as far as possible.'),
    touch: () => tr('화면을 짧게 탭하면 낮은 점프, 손가락을 꾹 누르고 있으면 최고 높이 점프(홀드 점프)를 뜁니다.', 'Quick tap for a low jump; hold your finger down to reach maximum jump height.'),
    keyboard: () => tr('스페이스, 엔터, 또는 아무 키나 탭하거나 길게 누릅니다.', 'Tap or hold Space, Enter, or any keyboard key.'),
    tips: () => tr('• 지상 대형 장애물: 반드시 꾹 눌러 최고 점프를 뛰어야 넘을 수 있습니다.\n• 공중 대형 장애물: 화면 위쪽을 완전히 가로막으므로 절대 점프하지 말고 손을 떼고 가만히 걸어서 지나가세요!\n• 볼록 언덕 장애물: 가운데가 솟아오른 피라미드 장애물은 중앙 최고점을 노려 부드럽게 뛰어넘으세요.', '• Tall ground hurdles require a full-height hold jump.\n• Giant ceiling blocks cover the entire top—never jump, just walk underneath safely!\n• For pyramid hill clusters, time your peak arc over the taller center block.')
  },
  blackjack: {
    icon: '♠',
    shortTitle: () => tr('블랙잭', 'Blackjack'),
    title: () => tr('블랙잭', 'Blackjack'),
    summary: () => tr('카드 숫자의 합을 21에 최대한 가깝게 만들어 딜러를 꺾는 정통 카지노 카드 게임입니다.', 'Classic casino blackjack. Beat the dealer by getting as close to 21 as possible without busting.'),
    touch: () => tr('• 판돈 조절: + / - 원형 버튼 (길게 누르면 최소/최대 판돈)\n• 시작 & 히트: 게임 시작 / 히트 버튼 탭\n• 스탠드: 스탠드 버튼 탭', '• Adjust Bet: + / - buttons (long press for min/max)\n• Start & Hit: Tap Start / Hit\n• Stand: Tap Stand'),
    keyboard: () => tr('• 판돈 조절: ↑ / → (올리기), ↓ / ← (내리기)\n• 게임 시작 & 히트: Enter 또는 Space\n• 스탠드: S 또는 ↓ 키\n• 이어하기: Enter 또는 C 키\n• 기록 후 새로하기: N 또는 R 키', '• Bet: ↑ / → (Up), ↓ / ← (Down)\n• Deal & Hit: Enter or Space\n• Stand: S or ↓ key\n• Continue: Enter or C key\n• Cash out & Restart: N or R key'),
    tips: () => tr('• 내추럴 블랙잭(처음 2장으로 21)은 1.5배(3:2) 배당을 받습니다.\n• 최고 기록 규칙: 게임 도중 돈을 땄더라도 자발적으로 [기록 후 새로하기]를 눌러 캐시아웃해야 최종 잔고가 공식 최고 기록으로 등록됩니다!', '• Natural blackjack (first 2 cards = 21) pays 3:2 bonus.\n• Cash-out Rule: Your bankroll is only recorded as a Best Record when you voluntarily tap [Cash out & Restart]!')
  }
};

function renderGuideDetails(gameId) {
  currentGuideGame = gameId;
  const data = guideData[gameId];
  if (!data) return;

  const curIdx = GUIDE_GAMES.indexOf(gameId);

  const navIcon = $('#guide-nav-icon');
  if (navIcon) navIcon.textContent = data.icon;
  const navTitle = $('#guide-nav-title');
  if (navTitle) navTitle.textContent = data.title();

  const gameNameEl = $('#guide-game-name');
  if (gameNameEl) gameNameEl.textContent = `${data.icon} ${data.title()}`;

  $('#guide-summary').textContent = data.summary();
  $('#guide-touch').textContent = data.touch();
  $('#guide-keyboard').textContent = data.keyboard();
  $('#guide-tips').textContent = data.tips();

  $$('.guide-dot').forEach((dot, idx) => {
    const isActive = idx === curIdx;
    dot.classList.toggle('active', isActive);
    dot.setAttribute('aria-current', isActive ? 'true' : 'false');
  });

  const body = $('#guide-body');
  if (body) body.scrollTop = 0;
}

function stepGuideGame(delta) {
  const curIdx = GUIDE_GAMES.indexOf(currentGuideGame);
  const nextIdx = (curIdx + delta + GUIDE_GAMES.length) % GUIDE_GAMES.length;
  renderGuideDetails(GUIDE_GAMES[nextIdx]);
}

function openGuideModal(initialGame = 'reaction') {
  guideModalTrigger = document.activeElement;
  renderGuideDetails(initialGame);
  $('#guide-modal').hidden = false;
  $('#guide-close').focus();
}

function closeGuideModal() {
  $('#guide-modal').hidden = true;
  guideModalTrigger?.focus();
  guideModalTrigger = null;
}

function syncSettingChoices() {
  $$('[data-language-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.languageChoice === language));
  });
  $$('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
  });
  const contrastNote = $('#contrast-note');
  if (contrastNote) {
    const showContrastNote = theme === 'contrast';
    contrastNote.style.visibility = showContrastNote ? 'visible' : 'hidden';
    contrastNote.setAttribute('aria-hidden', String(!showContrastNote));
  }
}

function clearResetRecordsStatus() {
  if (resetRecordsStatusTimer) {
    clearTimeout(resetRecordsStatusTimer);
    resetRecordsStatusTimer = null;
  }
  const statusEl = $('#reset-records-status');
  if (statusEl) statusEl.textContent = '';
}

function closeResetRecordsDialog() {
  $('#reset-records-confirm').hidden = true;
  resetRecordsTrigger?.focus();
  resetRecordsTrigger = null;
}

// Event Listeners
$('#settings-back').addEventListener('click', () => {
  clearResetRecordsStatus();
  location.hash = '';
});

window.addEventListener('hashchange', () => {
  if (location.hash !== '#settings') {
    clearResetRecordsStatus();
  }
});

$$('[data-language-choice]').forEach(button => button.addEventListener('click', () => {
  language = button.dataset.languageChoice;
  writePreference('watch-language', language);
  clearResetRecordsStatus();
  applyLanguage();
}));

let systemThemeClickCount = 0;
let systemThemeClickTimer = null;

$$('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.themeChoice === 'system') {
    if (systemThemeClickTimer) clearTimeout(systemThemeClickTimer);
    systemThemeClickCount++;
    if (systemThemeClickCount >= 10) {
      systemThemeClickCount = 0;
      document.body.classList.toggle('debug-mode');
      navigator.vibrate?.(50);
    } else {
      systemThemeClickTimer = setTimeout(() => {
        systemThemeClickCount = 0;
      }, 3000);
    }
  } else {
    systemThemeClickCount = 0;
  }
  theme = button.dataset.themeChoice;
  writePreference('watch-theme', theme);
  applyTheme();
}));

// 가이드 / 튜토리얼 이벤트 리스너
$('#open-guide')?.addEventListener('click', () => {
  openGuideModal('reaction');
});

$('#guide-prev')?.addEventListener('click', () => {
  stepGuideGame(-1);
});

$('#guide-next')?.addEventListener('click', () => {
  stepGuideGame(1);
});

$$('.guide-dot').forEach((dot, idx) => {
  dot.addEventListener('click', () => {
    if (GUIDE_GAMES[idx]) renderGuideDetails(GUIDE_GAMES[idx]);
  });
});

$('#guide-close')?.addEventListener('click', () => {
  closeGuideModal();
});

// 워치 터치 좌우 스와이프로 가이드 게임 넘기기
let guideTouchStartX = 0;
let guideTouchStartY = 0;
const guideModalEl = $('#guide-modal');
guideModalEl?.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    guideTouchStartX = e.touches[0].clientX;
    guideTouchStartY = e.touches[0].clientY;
  }
}, { passive: true });

guideModalEl?.addEventListener('touchend', (e) => {
  if (e.changedTouches.length === 1) {
    const deltaX = e.changedTouches[0].clientX - guideTouchStartX;
    const deltaY = e.changedTouches[0].clientY - guideTouchStartY;
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX < 0) {
        stepGuideGame(1);
      } else {
        stepGuideGame(-1);
      }
    }
  }
}, { passive: true });

let resetRecordsStatusTimer = null;

$('#reset-records').addEventListener('click', () => {
  resetRecordsTrigger = document.activeElement;
  $('#reset-records-confirm').hidden = false;
  clearResetRecordsStatus();
  $('#reset-records-cancel').focus();
});

$('#reset-records-cancel').addEventListener('click', () => {
  closeResetRecordsDialog();
});

$('#reset-records-confirm-button').addEventListener('click', () => {
  try { recordKeys.forEach(key => localStorage.removeItem(key)); } catch (_) {}
  closeResetRecordsDialog();
  clearResetRecordsStatus();
  const statusEl = $('#reset-records-status');
  if (statusEl) {
    statusEl.textContent = tr('최고 기록을 초기화했어요.', 'Best records have been reset.');
    resetRecordsStatusTimer = setTimeout(() => {
      clearResetRecordsStatus();
    }, 4000);
  }
  if (window.updateGameBestDisplay) window.updateGameBestDisplay();
});

window.addEventListener('keydown', event => {
  if (location.hash !== '#settings') return;

  const guideModal = $('#guide-modal');
  const guideOpen = guideModal && !guideModal.hidden;
  if (guideOpen) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeGuideModal();
      return;
    }
    // 좌우 방향키 및 < / > 키로 게임 전환
    if (event.key === 'ArrowRight' || event.key === '>' || event.key === '.') {
      event.preventDefault();
      stepGuideGame(1);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === '<' || event.key === ',') {
      event.preventDefault();
      stepGuideGame(-1);
      return;
    }
    // 위아래 방향키 및 페이지 키로 가이드 본문 스크롤
    const guideBody = $('#guide-body');
    if (guideBody) {
      const SCROLL_STEP = 55;
      if (event.key === 'ArrowDown' || event.key === 'Down') {
        event.preventDefault();
        guideBody.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' });
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'Up') {
        event.preventDefault();
        guideBody.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' });
        return;
      }
      if (event.key === 'PageDown') {
        event.preventDefault();
        guideBody.scrollBy({ top: guideBody.clientHeight * 0.75, behavior: 'smooth' });
        return;
      }
      if (event.key === 'PageUp') {
        event.preventDefault();
        guideBody.scrollBy({ top: -guideBody.clientHeight * 0.75, behavior: 'smooth' });
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        guideBody.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        guideBody.scrollTo({ top: guideBody.scrollHeight, behavior: 'smooth' });
        return;
      }
    }
    return;
  }

  const resetRecordsDialog = $('#reset-records-confirm');
  const modalOpen = resetRecordsDialog && !resetRecordsDialog.hidden;

  // 1. 확인 모달 제어
  if (modalOpen) {
    if (event.key === 'Tab') {
      event.preventDefault();
      const cancelButton = $('#reset-records-cancel');
      const confirmButton = $('#reset-records-confirm-button');
      (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeResetRecordsDialog();
      return;
    }
    return;
  }

  // 2. Escape 키: 메뉴로 나가기
  if (event.key === 'Escape') {
    event.preventDefault();
    location.hash = '';
    return;
  }

  const content = $('.settings-content');
  if (!content) return;

  // 3. 방향키 및 페이지 키 스크롤 제어
  const SCROLL_STEP = 55;
  if (event.key === 'ArrowDown' || event.key === 'Down') {
    // 포커스가 버튼에 있는 경우 브라우저 기본 포커스 이동을 방해하지 않되, 포커스가 컨테이너나 본문에 있을 때는 스크롤
    if (!document.activeElement || document.activeElement === document.body || document.activeElement === content) {
      event.preventDefault();
      content.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' });
    }
  } else if (event.key === 'ArrowUp' || event.key === 'Up') {
    if (!document.activeElement || document.activeElement === document.body || document.activeElement === content) {
      event.preventDefault();
      content.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' });
    }
  } else if (event.key === 'PageDown') {
    event.preventDefault();
    content.scrollBy({ top: content.clientHeight * 0.75, behavior: 'smooth' });
  } else if (event.key === 'PageUp') {
    event.preventDefault();
    content.scrollBy({ top: -content.clientHeight * 0.75, behavior: 'smooth' });
  } else if (event.key === 'Home') {
    event.preventDefault();
    content.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (event.key === 'End') {
    event.preventDefault();
    content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
  }

  // 4. 언어 및 테마 선택 버튼 그룹 내 방향키 탐색 지원
  const active = document.activeElement;
  if (active && active.classList.contains('setting-choice')) {
    const parentGrid = active.closest('.setting-options');
    if (parentGrid) {
      const choices = Array.from(parentGrid.querySelectorAll('.setting-choice'));
      const idx = choices.indexOf(active);
      const cols = parentGrid.classList.contains('two-columns') ? 2 : choices.length;
      let nextIdx = -1;

      if (event.key === 'ArrowRight') {
        if (idx < choices.length - 1) nextIdx = idx + 1;
      } else if (event.key === 'ArrowLeft') {
        if (idx > 0) nextIdx = idx - 1;
      } else if (event.key === 'ArrowDown' && cols === 2) {
        if (idx + 2 < choices.length) nextIdx = idx + 2;
      } else if (event.key === 'ArrowUp' && cols === 2) {
        if (idx - 2 >= 0) nextIdx = idx - 2;
      }

      if (nextIdx >= 0) {
        event.preventDefault();
        choices[nextIdx].focus();
        choices[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }
});

// PC 마우스 드래그 스크롤 기능
function bindMouseDragScroll(el) {
  if (!el) return;

  let isDown = false;
  let startY = 0;
  let startScrollTop = 0;
  let hasDragged = false;

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 좌클릭만
    isDown = true;
    hasDragged = false;
    startY = e.clientY;
    startScrollTop = el.scrollTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const deltaY = e.clientY - startY;
    if (Math.abs(deltaY) > 4) {
      hasDragged = true;
      el.classList.add('is-dragging');
    }
    if (hasDragged) {
      el.scrollTop = startScrollTop - deltaY;
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isDown) return;
    isDown = false;
    el.classList.remove('is-dragging');
    setTimeout(() => {
      hasDragged = false;
    }, 50);
  });

  el.addEventListener('click', (e) => {
    if (hasDragged) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
}

bindMouseDragScroll($('.settings-content'));
bindMouseDragScroll($('#guide-body'));
