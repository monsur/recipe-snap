# Status

**Status:** Active <!-- Active | Paused | Blocked | Done -->
**Updated:** 2026-11-04

## Summary

Single-page web app using Google Gemini to extract recipes from photos and export as .paprikarecipe files for Paprika Recipe Manager.

## Last Session

- Merged `feature/response-schema` into `main` and deleted old branches; `main` is the only branch and GitHub Pages publishes from it.
- Fixed 17 audit issues, including retries with a 90 s timeout, the API key sent in a header, clearer error messages, the HEIC library loaded only when needed, and camera start/switch bugs.
- Switched the default model to `gemini-3.5-flash-lite` (the old preview model was shut down on 2026-05-25). Expanded the prompt: all photos are one recipe, copy only what's shown, numbered steps.
- Images are now always a JPEG within 1600px, encoded once. Fixed iPhone camera issues (blank preview, buttons cut off, preview resizing) and stopped Safari zooming into text fields.
- The `.paprikarecipe` download now includes photos: a 280px thumbnail plus every photo in the gallery, with `photo_large`. Confirmed by importing test files into Paprika.
- Cleaned up the tests (removed placeholder tests, fixed unreliable ones; 492 tests in total). Rewrote the README and `TESTING.md`.

## Next

- Add timing logs for an extraction (photo prep, upload, Gemini's reply, and Gemini's token counts including thinking), then decide whether to lower Gemini's thinking level, the top latency idea.

## Notes

- No backend; single HTML file hosted on GitHub Pages
- Requires a Gemini API key at runtime
- Paprika photo import: with a main photo, Paprika drops gallery photos it already has in its library, so test imports need fresh photos. The layout that works is thumbnail + `photos` + `photo_large`.
- When changing the default model or prompt, add the old value to `CONFIG.previousDefaults`.
- Read Playwright failure counts, not just the last line, which can say "N passed" even when tests failed.
- iPhone Safari needs 16px text in fields (to prevent zooming) and `100dvh` (to keep content above the toolbar).
