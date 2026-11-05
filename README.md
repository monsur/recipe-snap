# Recipe Snap

A single-page web app that uses Google Gemini to extract recipes from photos and export them as `.paprikarecipe` files for import into [Paprika Recipe Manager](https://www.paprikaapp.com/).

Live at **https://monsur.hossa.in/recipe-snap/**

## How it works

1. **Setup** — enter your Gemini API key (once; it's remembered).
2. **Upload** — take photos with the camera or upload them. A recipe can span several photos (for example two cookbook pages); they're treated as one recipe and can be in any order.
3. **Extract Recipe** — Gemini reads the photos and returns the recipe as structured JSON.
4. **Review** — edit the JSON in the editor if needed, or copy it.
5. **Download** — save the `.paprikarecipe` file and open it in Paprika. The recipe's photos are included.

## Settings

Under **Setup → Advanced Options**:

| Setting | Default | Notes |
|---------|---------|-------|
| Model | `gemini-3.5-flash-lite` | Any Gemini model that supports image input and structured output |
| Source | empty | If set, added to every recipe's `source` field (e.g. a cookbook name) |
| Prompt | Built-in prompt | Tells Gemini to copy only what's shown, keep the original wording, and number the steps |

Leaving Model or Prompt at its default means you get future default changes automatically. **Clear all data** removes the API key and all settings.

## API key

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey). The key is stored in your browser's `localStorage` and sent only to Google, in a request header (not in the URL).

## The Paprika file

A `.paprikarecipe` file is gzip-compressed JSON. Recipe Snap writes:

- **Recipe fields** — `name`, `ingredients`, `directions`, `servings`, `prep_time`, `cook_time`, `total_time`, `description`, `notes`, `source`, `source_url`. Gemini's response schema uses these exact Paprika field names, so its output is already in Paprika's format.
- **Photos** — added only to the downloaded file, never to the editor or copied text:
  - `photo`, `photo_data`, `photo_hash`: the main photo, a 280×280 thumbnail cropped from the centre of the first photo (`photo_hash` is the SHA-256 of the thumbnail bytes, in uppercase hex)
  - `photos`: every photo, full size, in the recipe's gallery
  - `photo_large`: the first gallery photo, so tapping the thumbnail in Paprika opens it

This layout was confirmed by importing test files into Paprika. One quirk: if a recipe's gallery photos are identical to photos already in your Paprika library, Paprika may leave them out of the gallery. Real recipes always have new photos, so this only affects re-importing the same file.

## Image handling

- Every image sent to Gemini is a JPEG no larger than 1600px on its longest side, encoded at most once (quality 0.92). JPEGs that already fit are sent unchanged.
- HEIC/HEIF photos (from iPhone) are converted in the browser. The converter (~2.5 MB) loads only when a HEIC file is uploaded.
- PNG and WebP files are converted to JPEG.
- Camera photos are encoded at their final size when taken.

## Reliability

- Requests time out after 90 seconds.
- Temporary failures (network errors, rate limits, server errors, unreadable responses) are retried up to 3 times.
- Errors that retrying can't fix (an invalid API key, a blocked or truncated response, no recipe found) are reported straight away with a specific message.

## Hosting

The app is a single HTML file with no backend, hosted on GitHub Pages from the `main` branch. GitHub Pages caches files for about 10 minutes, so reload to see a new deploy.

To host your own copy:
1. Push the repo to GitHub
2. Go to **Settings → Pages**
3. Set source to the `main` branch, `/ (root)` folder

## Running locally

Serve the project root with any static file server, for example:

```bash
npx http-server . -p 8080
```

Then open `http://localhost:8080`. The camera needs HTTPS on a phone, so test it on the hosted site or on `localhost`.

## Running tests

The project uses [Playwright](https://playwright.dev/) for end-to-end tests in Chromium, Firefox and WebKit. Gemini, the camera and the HEIC converter are replaced with stand-ins, so the tests need no API key, camera or network.

```bash
# Run all tests (headless)
npm test

# Run with interactive UI — recommended during development
npm run test:ui

# Run in a single browser (faster)
npm run test:chromium

# View the last test report
npm run test:report
```

Run a specific test file, or tests matching a name:

```bash
npx playwright test tests/download.spec.js
npx playwright test -g "should download a gzip"
```

When reading results, check for failed or flaky tests, which are listed above the final summary line; the last line alone can read "N passed" even when some failed.

### Test files

| File | What it covers |
|------|----------------|
| `setup.spec.js` | API key, settings and defaults, Clear all data, phone layout |
| `upload.spec.js` | File upload, file types, HEIC conversion, image sizing |
| `camera.spec.js` | Camera open/close, capture, switching cameras, Done button, layout |
| `extraction.spec.js` | Gemini requests (mocked), retries, timeouts, error messages |
| `download.spec.js` | Recipe editor, Copy, gzip output, photos in the Paprika file |
| `integration.spec.js` | End-to-end workflows, reset, Clear all data |
| `helpers.js` | Shared test helpers |

## Changing a default

The defaults live in `CONFIG` near the top of the app's script. When you change the default model or prompt, add the old value to `CONFIG.previousDefaults`, so people who saved the old default are moved to the new one.
