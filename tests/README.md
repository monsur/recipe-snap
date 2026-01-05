# Test Suite Overview

This directory contains comprehensive end-to-end tests for Recipe Snap using Playwright.

## Test Files

### [setup.spec.js](setup.spec.js)
Tests for Step 1: Setup & Configuration
- ✅ API key input and storage
- ✅ localStorage persistence
- ✅ Advanced options (model, prompt)
- ✅ Clear data functionality
- ✅ Step expand/collapse UI

**Run only these tests:**
```bash
npx playwright test setup.spec.js
```

### [upload.spec.js](upload.spec.js)
Tests for Step 2: Image Upload & Processing
- ✅ Upload button interactions
- ✅ File input handling
- ✅ Image preview display
- ✅ HEIC conversion
- ✅ Image resizing (1600px max)
- ✅ Base64 conversion
- ✅ Multiple image support

**Run only these tests:**
```bash
npx playwright test upload.spec.js
```

### [extraction.spec.js](extraction.spec.js)
Tests for Step 2: Gemini API Integration
- ✅ API SDK loading
- ✅ Recipe extraction function
- ✅ API key validation
- ✅ Successful API calls (mocked)
- ✅ Error handling
- ✅ Loading states
- ✅ Custom model/prompt usage

**Run only these tests:**
```bash
npx playwright test extraction.spec.js
```

### [download.spec.js](download.spec.js)
Tests for Step 3: Export & Download
- ✅ Recipe editor display
- ✅ JSON formatting
- ✅ Recipe editing
- ✅ .paprikarecipe file download
- ✅ Copy to clipboard
- ✅ Filename sanitization
- ✅ JSON validation

**Run only these tests:**
```bash
npx playwright test download.spec.js
```

### [integration.spec.js](integration.spec.js)
End-to-End Integration Tests
- ✅ Complete workflows
- ✅ Multi-step interactions
- ✅ Error scenarios
- ✅ Edge cases
- ✅ Data persistence
- ✅ Cross-browser compatibility

**Run only these tests:**
```bash
npx playwright test integration.spec.js
```

## Quick Commands

Run a specific test:
```bash
npx playwright test setup.spec.js --headed
```

Run a specific test case by name:
```bash
npx playwright test -g "should store API key"
```

Debug a specific test:
```bash
npx playwright test setup.spec.js --debug
```

Run tests in a specific browser:
```bash
npx playwright test setup.spec.js --project=chromium
```

## Test Statistics

- **Total Tests**: 192 (64 tests × 3 browsers)
- **Setup Tests**: 12
- **Upload Tests**: 14
- **Extraction Tests**: 14
- **Download Tests**: 16
- **Integration Tests**: 14

## Coverage Areas

### Functionality
- [x] User input and validation
- [x] Data persistence (localStorage)
- [x] API integration (mocked)
- [x] File uploads
- [x] File downloads
- [x] Clipboard operations
- [x] Image processing
- [x] Error handling

### User Experience
- [x] Loading states
- [x] Success/error messages
- [x] UI interactions (collapse, expand)
- [x] Form validation
- [x] Responsive behavior

### Edge Cases
- [x] Missing API key
- [x] No images uploaded
- [x] Invalid JSON
- [x] Special characters in filenames
- [x] Multiple images
- [x] API rate limiting
- [x] HEIC files

### Browsers
- [x] Chromium
- [x] Firefox
- [x] WebKit (Safari)

## Development Workflow

1. Write a test (it will fail - Red)
2. Implement the feature in [recipe-snap.html](../recipe-snap.html)
3. Run the test (it should pass - Green)
4. Refactor if needed (keep tests passing)

## Debugging Tips

1. **Use UI mode for interactive debugging:**
   ```bash
   npm run test:ui
   ```

2. **Run a single test in headed mode:**
   ```bash
   npx playwright test setup.spec.js --headed
   ```

3. **Pause execution and use Playwright Inspector:**
   ```bash
   npx playwright test --debug
   ```

4. **Check test reports:**
   ```bash
   npm run test:report
   ```

5. **View screenshots of failures:**
   Look in `test-results/` directory

## Adding New Tests

Follow this template:

```javascript
test('should [describe expected behavior]', async ({ page }) => {
  // Arrange - set up initial state
  await page.goto('/recipe-snap.html');
  await page.evaluate(() => localStorage.clear());

  // Act - perform the action
  await page.locator('#someButton').click();

  // Assert - verify the result
  await expect(page.locator('#result')).toHaveText('Expected Text');
});
```

## Notes

- Many tests will initially fail because features aren't implemented yet
- This is expected for TDD (Test-Driven Development)
- Tests use mocked API responses to avoid real API calls
- All tests clean up localStorage before running
- Tests are independent and can run in any order
