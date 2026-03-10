# Recipe Snap

A single-page web app that uses Google Gemini to extract recipes from photos and export them as `.paprikarecipe` files for import into [Paprika Recipe Manager](https://www.paprikaapp.com/).

## How it works

1. Enter your Gemini API key
2. Upload a photo (or multiple photos) of a recipe
3. Click **Extract Recipe** — Gemini analyzes the image and returns structured JSON
4. Review and edit the JSON if needed
5. Download the `.paprikarecipe` file and import it into Paprika

## Hosting

The app is a single HTML file with no backend. It can be hosted for free on GitHub Pages.

To enable GitHub Pages:
1. Push the repo to GitHub
2. Go to **Settings → Pages**
3. Set source to `main` branch, `/ (root)` folder
4. The app will be available at `https://<your-username>.github.io/recipe-snap/`

## API Key

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey). Your key is stored in your browser's `localStorage` and is sent directly to Google — it never touches any other server.

## Running locally

Serve the project root with any static file server, for example:

```bash
npx http-server . -p 8080
```

Then open `http://localhost:8080`.

## Running tests

The project uses [Playwright](https://playwright.dev/) for end-to-end tests.

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

Run a specific test file:

```bash
npx playwright test tests/download.spec.js
```

Run tests matching a name:

```bash
npx playwright test -g "should download a gzip"
```

### Test files

| File | What it covers |
|------|----------------|
| `setup.spec.js` | API key input, localStorage persistence, settings |
| `upload.spec.js` | File upload, HEIC conversion, image resizing |
| `extraction.spec.js` | Gemini API integration (mocked), error handling |
| `download.spec.js` | Recipe editor, gzip output, Paprika file format |
| `integration.spec.js` | End-to-end workflows |

## Notes

- HEIC photos (from iPhone) are automatically converted to JPEG before upload
- Images are resized to a 1600px maximum before being sent to Gemini
- Downloaded `.paprikarecipe` files are gzip-compressed JSON, which is the format Paprika expects
- Photos are intentionally **not** embedded in the output — this avoids import errors in Paprika
