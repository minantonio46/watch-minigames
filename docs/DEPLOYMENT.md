# Deployment Guide

This project is published through GitHub Pages from the repository root on the `main` branch.

## Before release

1. Test the live game locally in a current Chromium browser and on a narrow mobile viewport.
2. Check every game can start, finish, and return to the menu.
3. Check Korean and English, plus all four themes.
4. Confirm the GitHub link in Settings opens the intended public repository.
5. Review `git status` and ensure no credentials, `.env` files, logs, or unrelated files are staged.
6. Update documentation if player-facing controls or games changed.

## Publish

1. Commit the reviewed changes to `main`.
2. Push `main` to GitHub.
3. Wait for the GitHub Pages deployment to complete.
4. Open <https://minantonio46.github.io/watch-minigames/> in a private/incognito window and smoke-test the release.

## Rollback

If a deployed change is broken, revert the faulty commit with a new commit and push `main`. Avoid force-pushing a shared release branch.

## Repository hygiene

The repository is public-facing. Put only project documentation in `docs/`; do not store passwords, tokens, private URLs, personal notes, or unreviewed third-party assets there.
