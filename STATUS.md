# Status

**Status:** Active <!-- Active | Paused | Blocked | Done -->
**Updated:** 2026-04-17

## Summary

Single-page web app using Google Gemini to extract recipes from photos and export as .paprikarecipe files for Paprika Recipe Manager.

## Last Session

- Enforced Paprika schema directly via Gemini `responseSchema` (branch: `feature/response-schema`)
- Normalized Gemini response to Paprika flat-string format; mapped `instructions` → `directions`
- Forced JSON output via `responseMimeType`; added markdown parser as fallback for prose responses
- Updated default Gemini model

## Next

- Merge `feature/response-schema` into `main`

## Notes

- No backend; single HTML file hosted on GitHub Pages
- Requires a Gemini API key at runtime
