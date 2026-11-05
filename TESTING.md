# Recipe Snap - Testing Guide

Recipe Snap uses [Playwright](https://playwright.dev/) for end-to-end tests. Every test runs in Chromium, Firefox and WebKit (Safari's engine): 164 tests per browser, 492 in total. All of them should pass.

## Test Structure

```
tests/
├── setup.spec.js        - Step 1: API key, settings and defaults, Clear all data, phone layout   (25)
├── upload.spec.js       - Step 2: file upload, file types, HEIC conversion, image sizing         (24)
├── camera.spec.js       - Step 2: camera open/close, capture, switching, Done button, layout     (32)
├── extraction.spec.js   - Step 2: Gemini requests, retries, timeouts, error messages             (35)
├── download.spec.js     - Step 3: editor, Copy, gzip output, photos in the Paprika file          (24)
├── integration.spec.js  - End-to-end workflows, reset, Clear all data                            (24)
├── helpers.js           - Shared helpers (see below)
└── fixtures/            - Small and large PNG images used by upload tests, and the scripts that made them
```

Counts are per browser.

## Running Tests

```bash
npm test                 # all tests, all browsers (about 1.5 minutes)
npm run test:ui          # interactive UI mode, recommended during development
npm run test:headed      # watch the browser
npm run test:debug       # step through with the Playwright Inspector
npm run test:chromium    # one browser (also test:firefox, test:webkit)
npm run test:report      # open the last HTML report
```

Run one file, or tests whose name matches:

```bash
npx playwright test tests/camera.spec.js
npx playwright test -g "Done is hidden"
```

Playwright starts the app automatically with `http-server` on port 8080.

### Reading the results

Failed and flaky tests are listed **above** the final summary line. The last line alone can read "N passed" even when some tests failed, so check for a "failed" or "flaky" count, or compare the passed count with the total:

```bash
npx playwright test --list | tail -1    # total number of tests
```

## Stand-ins for External Things

The tests need no API key, camera or network. Everything external is replaced:

| Real thing | Stand-in |
|------------|----------|
| Gemini API | `page.route('**/generativelanguage.googleapis.com/**', ...)` returns a canned response, error status, or slow reply |
| Camera | `MediaDevices.prototype.getUserMedia` is replaced (via `addInitScript`, before the page loads) with a stream from an animated canvas. Patching the prototype, not `navigator.mediaDevices`, is needed for WebKit. |
| HEIC converter (heic-to, loaded from a CDN) | Requests to `heic-to` are answered with a small script that defines a fake `HeicTo` |
| Clipboard | `stubClipboard()` replaces `navigator.clipboard`; only Chromium lets Playwright grant real clipboard access |

Example Gemini stand-in:

```javascript
await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(mockRecipe) }] } }] })
}));
```

## Helpers (`tests/helpers.js`)

| Helper | Use |
|--------|-----|
| `expandStep(page, 'step2')` | Opens a collapsed step so its buttons can be clicked |
| `stubClipboard(page)` / `readStubClipboard(page)` | Fake clipboard, and read what the app wrote to it |
| `collectDialogs(page)` | Accepts every alert/confirm and returns their messages |
| `fastRetries(page)` | Shrinks retry delays so retry tests run quickly |
| `clickClearAllData(page)` | Clicks **Clear all data** reliably (see Known Issues) |

## Writing New Tests

1. Add the test to the spec file for that part of the app.
2. Check it **fails without your change** and passes with it. A quick way, while the change is uncommitted:
   ```bash
   cp index.html /tmp/index.new && git show HEAD:index.html > index.html
   npx playwright test -g "your test name"     # should fail
   cp /tmp/index.new index.html                # restore your change
   ```
3. Run the full suite and check there are no failed or flaky tests.

Guidelines:
- Assert the behaviour itself, e.g. "the alert says X" or "the file contains Y". A check like `expect(typeof x).toBe('boolean')` can never fail and tests nothing.
- Prefer `expect(...)` and `expect.poll(...)`, which wait, over fixed `waitForTimeout` delays.
- When measuring layout, wait for animations (steps and Advanced Options expand with a CSS transition) to finish first.
- Install init scripts (`addInitScript`) before `page.goto`.

## Known Issues

- **Firefox and the "Clear all data" link:** under test automation Firefox sometimes receives the mouse press on this link but never fires the click (about 1 run in 20). `clickClearAllData()` sends the click event directly instead. It isn't a bug in the app.

## What the Tests Don't Cover

These need a manual check on a real device after related changes:

- **iPhone Safari:** the real camera, permission prompts, the bottom toolbar overlapping the page, and zooming into text fields. The tests use an iPhone-sized window, not Safari itself.
- **Real Gemini responses:** whether the model follows the prompt (numbered steps, nothing invented). Try a few real recipes.
- **Paprika import:** whether downloaded files import correctly, with the thumbnail and gallery. Import a real download into Paprika.
- **The real HEIC converter:** upload an actual HEIC photo.

## Debugging Failed Tests

1. `npm run test:ui` to run and watch tests interactively.
2. `npm run test:debug` to step through a test.
3. Screenshots and page snapshots of failures are in `test-results/`.
4. `npm run test:report` shows the HTML report with traces.
5. Use `--repeat-each=20` on a single test to check whether a failure is flaky.
