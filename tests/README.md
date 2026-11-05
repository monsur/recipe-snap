# Tests

End-to-end tests for Recipe Snap, run with Playwright in Chromium, Firefox and WebKit.

See **[TESTING.md](../TESTING.md)** for the full guide: what each file covers, the stand-ins for Gemini, the camera and the HEIC converter, shared helpers, how to write and verify new tests, and known issues.

## Quick commands

```bash
npm test                                   # everything
npx playwright test tests/camera.spec.js   # one file
npx playwright test -g "Done is hidden"    # tests matching a name
npx playwright test --project=chromium     # one browser
npm run test:ui                            # interactive
```

Check for failed or flaky tests above the final summary line: the last line alone can say "N passed" even when some failed.
