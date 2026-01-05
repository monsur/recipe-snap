# Recipe Snap - Testing Guide

This project uses [Playwright](https://playwright.dev/) for end-to-end testing to ensure changes are safe as they're being made.

## Test Structure

```
tests/
├── setup.spec.js       - Step 1: API key management and settings
├── upload.spec.js      - Step 2: Image upload and processing
├── extraction.spec.js  - Step 2: Gemini API integration
├── download.spec.js    - Step 3: Recipe export and download
└── integration.spec.js - End-to-end workflows
```

## Running Tests

### Run all tests (headless)
```bash
npm test
```

### Run tests with UI mode (recommended for development)
```bash
npm run test:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:headed
```

### Debug tests
```bash
npm run test:debug
```

### Run tests in specific browser
```bash
npm run test:chromium
npm run test:firefox
npm run test:webkit
```

### View last test report
```bash
npm run test:report
```

## Test-Driven Development Workflow

The tests are written following TDD principles. Many tests will **initially fail** because the functionality hasn't been implemented yet. This is expected and intentional.

### Workflow:
1. **Red** - Run tests, see them fail
2. **Green** - Implement the minimum code to make tests pass
3. **Refactor** - Improve the code while keeping tests green

### Example:
```bash
# Run tests to see what's failing
npm run test:ui

# Implement feature in recipe-snap.html
# ...

# Re-run tests to verify implementation
npm test
```

## What's Being Tested

### Setup Tests ([setup.spec.js](tests/setup.spec.js))
- API key storage in localStorage
- API key persistence across page loads
- Advanced options (custom model, custom prompt)
- Clear data functionality
- Step expand/collapse behavior

### Upload Tests ([upload.spec.js](tests/upload.spec.js))
- File upload button visibility
- Image preview display
- HEIC file conversion
- Image resizing to 1600px max
- Base64 conversion
- Multiple image handling

### Extraction Tests ([extraction.spec.js](tests/extraction.spec.js))
- Gemini API integration
- API request/response handling
- Error handling (invalid API key, rate limits)
- Loading states
- Custom model/prompt usage
- Multiple image processing

### Download Tests ([download.spec.js](tests/download.spec.js))
- Recipe JSON display in editor
- JSON editing
- .paprikarecipe file download
- Copy to clipboard
- Filename sanitization
- JSON validation

### Integration Tests ([integration.spec.js](tests/integration.spec.js))
- Complete workflow: setup → upload → extract → download
- Settings persistence
- Multi-image recipes
- Error handling scenarios
- Special characters in recipes
- Clear data workflow

## Mocking External APIs

The tests mock the Gemini API to avoid:
- Making real API calls during testing
- Incurring API costs
- Depending on external service availability
- Rate limiting issues

Example mock in tests:
```javascript
await page.route('**/generativelanguage.googleapis.com/**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify(mockRecipe) }]
        }
      }]
    })
  });
});
```

## Writing New Tests

When adding new features:

1. Write tests first (in appropriate spec file)
2. Run tests to see them fail
3. Implement the feature
4. Run tests to verify they pass

Test naming convention:
```javascript
test('should [expected behavior]', async ({ page }) => {
  // Arrange - set up test conditions
  // Act - perform the action
  // Assert - verify the result
});
```

## Continuous Integration

The test configuration is CI-ready:
- Uses `http-server` to serve the app locally
- Retries failed tests in CI environment
- Generates HTML reports
- Takes screenshots on failure
- Records traces for debugging

## Debugging Failed Tests

1. Use UI mode for interactive debugging:
   ```bash
   npm run test:ui
   ```

2. Use debug mode to step through tests:
   ```bash
   npm run test:debug
   ```

3. Check screenshots in `test-results/` folder

4. View trace files in the test report:
   ```bash
   npm run test:report
   ```

## Coverage

These tests cover:
- ✅ User interface interactions
- ✅ localStorage persistence
- ✅ API integration (mocked)
- ✅ File upload/download
- ✅ Image processing
- ✅ Error scenarios
- ✅ Edge cases (special characters, multiple images)

## Next Steps

As you implement features in [recipe-snap.html](recipe-snap.html):
1. Run the relevant test suite
2. Watch tests turn from red to green
3. Ensure all tests pass before committing changes
4. Add new tests for any additional functionality
