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
(function setupSettingsMouseDragScroll() {
  const content = $('.settings-content');
  if (!content) return;

  let isDown = false;
  let startY = 0;
  let startScrollTop = 0;
  let hasDragged = false;

  content.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 좌클릭만
    isDown = true;
    hasDragged = false;
    startY = e.clientY;
    startScrollTop = content.scrollTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const deltaY = e.clientY - startY;
    if (Math.abs(deltaY) > 4) {
      hasDragged = true;
      content.classList.add('is-dragging');
    }
    if (hasDragged) {
      content.scrollTop = startScrollTop - deltaY;
    }
  });

  window.addEventListener('mouseup', () => {
    if (!isDown) return;
    isDown = false;
    content.classList.remove('is-dragging');
    // 드래그 직후 발생하는 click 이벤트를 막기 위해 짧은 딜레이 후 해제
    setTimeout(() => {
      hasDragged = false;
    }, 50);
  });

  // 드래그 중 버튼이 눌리는 것 방지 (캡처 단계에서 차단)
  content.addEventListener('click', (e) => {
    if (hasDragged) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);
})();
