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
  $('#contrast-note').textContent = tr('검정 배경으로 OLED 화면 전력 사용을 줄이는 고대비 모드', 'High contrast with a black OLED-saving background');
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

function closeResetRecordsDialog() {
  $('#reset-records-confirm').hidden = true;
  resetRecordsTrigger?.focus();
  resetRecordsTrigger = null;
}

// Event Listeners
$('#settings-back').addEventListener('click', () => { location.hash = ''; });

$$('[data-language-choice]').forEach(button => button.addEventListener('click', () => {
  language = button.dataset.languageChoice;
  writePreference('watch-language', language);
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

$('#reset-records').addEventListener('click', () => {
  resetRecordsTrigger = document.activeElement;
  $('#reset-records-confirm').hidden = false;
  $('#reset-records-status').textContent = '';
  $('#reset-records-cancel').focus();
});

$('#reset-records-cancel').addEventListener('click', () => {
  closeResetRecordsDialog();
});

$('#reset-records-confirm-button').addEventListener('click', () => {
  try { recordKeys.forEach(key => localStorage.removeItem(key)); } catch (_) {}
  closeResetRecordsDialog();
  $('#reset-records-status').textContent = tr('최고 기록을 초기화했어요.', 'Best records have been reset.');
  if (window.updateGameBestDisplay) window.updateGameBestDisplay();
});

window.addEventListener('keydown', event => {
  const resetRecordsDialog = $('#reset-records-confirm');
  if (!resetRecordsDialog.hidden && event.key === 'Tab') {
    event.preventDefault();
    const cancelButton = $('#reset-records-cancel');
    const confirmButton = $('#reset-records-confirm-button');
    (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
    return;
  }
  if (event.key === 'Escape' && !resetRecordsDialog.hidden) {
    event.preventDefault();
    closeResetRecordsDialog();
  }
});
