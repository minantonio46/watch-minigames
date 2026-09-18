# Development Guide

This document is for maintainers working on the project.

## Project layout

- `index.html` contains the application structure.
- `style.css` holds shared watch layout, colour tokens, and common UI styles.
- `css/` contains feature and game-specific styles.
- `js/common.js` owns shared state, localisation helpers, and utilities.
- `js/router.js` switches between the menu, settings, and game views.
- `js/menu.js` implements the carousel menu.
- `js/settings.js` owns settings, guide modal, theme, and language behaviour.
- `js/games/` contains one module per game.
- `assets/` contains project-owned visual assets.
- `vendor/` contains checked-in third-party browser scripts.

## Local development

Open `index.html` directly in a modern browser. If browser security rules or debugging tools require HTTP, serve the repository root with any simple static server; no package installation is required by this project.

## Change checklist

1. Keep the watch safe area usable on a circular display.
2. Add Korean and English copy together. Use `tr(korean, english)` for UI text.
3. Verify touch and keyboard input; `Escape` should still return to the menu.
4. Test dark, light, system, and contrast themes.
5. Keep URLs external, HTTPS, and opened with `rel="noopener noreferrer"` when using a new tab.
6. Avoid adding secrets, credentials, personal data, or environment files to the repository.

## Records and settings

Browser-local preferences and records are intentionally stored on the device. Test a record-reset change with browser storage cleared and with existing saved preferences.
