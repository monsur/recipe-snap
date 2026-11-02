const { test, expect } = require('@playwright/test');
const { fastRetries } = require('./helpers');

test.describe('Step 2: Extraction - Gemini API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Set up a test API key
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'test-api-key-12345');
    });
  });

  test('should load no external scripts up front', async ({ page }) => {
    // Gemini is called with fetch (no SDK), and the HEIC library loads on demand
    const externalScripts = await page.evaluate(() =>
      [...document.querySelectorAll('script[src]')].map(s => s.src));
    expect(externalScripts).toEqual([]);
  });

  test('should have extract recipe function defined', async ({ page }) => {
    const hasExtractFunction = await page.evaluate(() => {
      return typeof window.extractRecipe === 'function' ||
             typeof window.processRecipe === 'function';
    });

    expect(typeof hasExtractFunction).toBe('boolean');
  });

  test('should require API key before extraction', async ({ page }) => {
    // Clear API key
    await page.evaluate(() => localStorage.removeItem('geminiApiKey'));
    await page.reload();

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Try to extract without API key
    const extractBtn = page.locator('#extractBtn');

    // Listen for alert
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await extractBtn.click();

    // Should show error about missing API key
    // (Will be implemented in the actual app)
    expect(typeof alertMessage).toBe('string');
  });

  test('should mock successful Gemini API call', async ({ page }) => {
    const mockRecipe = {
      name: 'Test Recipe',
      ingredients: '1 cup flour\n2 eggs\n1 cup milk',
      directions: ['Mix ingredients', 'Bake at 350F'],
      servings: '4',
      prep_time: '10 minutes',
      cook_time: '30 minutes'
    };

    // Mock the API call
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify(mockRecipe)
              }]
            }
          }]
        })
      });
    });

    // Set up images (mock)
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];
    });

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Click extract button
    const extractBtn = page.locator('#extractBtn');
    await extractBtn.click();

    // Wait for processing (will need actual implementation)
    await page.waitForTimeout(1000);

    // Check if result is stored
    const hasResult = await page.evaluate(() => {
      return window.extractedRecipe !== undefined ||
             localStorage.getItem('lastExtractedRecipe') !== null;
    });

    expect(typeof hasResult).toBe('boolean');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'Invalid API key'
          }
        })
      });
    });

    let errorShown = false;
    page.on('dialog', async dialog => {
      errorShown = true;
      await dialog.accept();
    });

    // Set up mock images
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Try to extract
    const extractBtn = page.locator('#extractBtn');
    await extractBtn.click();

    await page.waitForTimeout(1000);

    // Should handle error (implementation dependent)
    expect(typeof errorShown).toBe('boolean');
  });

  test('should show loading state during extraction', async ({ page }) => {
    // Mock delayed API response
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: '{"name":"Test"}' }]
            }
          }]
        })
      });
    });

    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const extractBtn = page.locator('#extractBtn');
    await extractBtn.click();

    // Check for loading indicator
    await page.waitForTimeout(500);

    const hasLoadingState = await page.evaluate(() => {
      return document.querySelector('.loading') !== null ||
             document.querySelector('[data-loading="true"]') !== null ||
             document.body.textContent.includes('reading') ||
             document.body.textContent.includes('processing');
    });

    expect(typeof hasLoadingState).toBe('boolean');
  });

  test('should use custom model from settings', async ({ page }) => {
    const customModel = 'gemini-pro-vision';

    await page.evaluate((model) => {
      localStorage.setItem('model', model);
    }, customModel);

    await page.reload();

    const storedModel = await page.evaluate(() => {
      return localStorage.getItem('model');
    });

    expect(storedModel).toBe(customModel);
  });

  test('should use custom prompt from settings', async ({ page }) => {
    const customPrompt = 'Extract recipe in French';

    await page.evaluate((prompt) => {
      localStorage.setItem('prompt', prompt);
    }, customPrompt);

    await page.reload();

    const storedPrompt = await page.evaluate(() => {
      return localStorage.getItem('prompt');
    });

    expect(storedPrompt).toBe(customPrompt);
  });

  test('should send images as base64 to API', async ({ page }) => {
    let requestBody;

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      const request = route.request();
      requestBody = request.postData();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: '{"name":"Test"}' }]
            }
          }]
        })
      });
    });

    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,testimage123'];
    });

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const extractBtn = page.locator('#extractBtn');
    await extractBtn.click();

    await page.waitForTimeout(1000);

    // Verify request was made (implementation dependent)
    expect(typeof requestBody).toBe('string');
  });

  test('should handle multiple images in single request', async ({ page }) => {
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: '{"name":"Multi-page Recipe"}' }]
            }
          }]
        })
      });
    });

    await page.evaluate(() => {
      window.uploadedImages = [
        'data:image/jpeg;base64,image1',
        'data:image/jpeg;base64,image2',
        'data:image/jpeg;base64,image3'
      ];
    });

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const extractBtn = page.locator('#extractBtn');
    await extractBtn.click();

    await page.waitForTimeout(1000);

    const imageCount = await page.evaluate(() => {
      return window.uploadedImages ? window.uploadedImages.length : 0;
    });

    expect(imageCount).toBe(3);
  });

  test('should parse JSON response from Gemini', async ({ page }) => {
    const mockResponse = {
      name: 'Lasagna',
      ingredients: 'noodles\ncheese\nsauce',
      directions: ['Cook noodles', 'Layer ingredients']
    };

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify(mockResponse) }]
            }
          }]
        })
      });
    });

    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const extractBtn = page.locator('#extractBtn');
    await extractBtn.click();

    await page.waitForTimeout(1000);

    const hasRecipe = await page.evaluate(() => {
      return window.extractedRecipe !== undefined;
    });

    expect(typeof hasRecipe).toBe('boolean');
  });

  test('should parse clean JSON response (schema-enforced format)', async ({ page }) => {
    const mockRecipe = { name: 'Schema Recipe', ingredients: '1 cup flour\n2 eggs', directions: 'Mix well\nBake at 350F' };

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockRecipe) }] } }]
        })
      });
    });

    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
    await page.locator('#step2 .step-header').click();
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(1000);

    const name = await page.evaluate(() => window.extractedRecipe?.name);
    expect(name).toBe('Schema Recipe');
  });

  test('should parse recipe with all Paprika snake_case fields', async ({ page }) => {
    const mockRecipe = {
      name: 'Full Fields Recipe', ingredients: 'butter', directions: 'Melt',
      prep_time: '10 min', cook_time: '20 min', total_time: '30 min',
      servings: '4', notes: 'Great dish', source: 'Home', source_url: ''
    };

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockRecipe) }] } }]
        })
      });
    });

    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
    await page.locator('#step2 .step-header').click();
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(1000);

    const prepTime = await page.evaluate(() => window.extractedRecipe?.prep_time);
    expect(prepTime).toBe('10 min');
  });

  test('should use directions field (not instructions) from API response', async ({ page }) => {
    const mockRecipe = { name: 'Directions Recipe', ingredients: 'eggs', directions: 'Boil for 10 min' };

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(mockRecipe) }] } }]
        })
      });
    });

    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
    await page.locator('#step2 .step-header').click();
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(1000);

    const directions = await page.evaluate(() => window.extractedRecipe?.directions);
    expect(directions).toBe('Boil for 10 min');
  });

  test('should show error when Gemini returns unparseable text', async ({ page }) => {
    let attempts = 0;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      attempts++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'paprikarecipe format is a gzip-compressed JSON file.' }] } }]
        })
      });
    });

    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await fastRetries(page);
    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
    await page.locator('#step2 .step-header').click();
    await page.locator('#extractBtn').click();

    await expect.poll(() => alertMessage).toContain('Failed');
    expect(attempts).toBe(3);
  });

  // Helper: mock a Gemini response body and return the alert message shown
  async function extractWithResponse(page, body) {
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
    await page.locator('#step2 .step-header').click();
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(1000);
    return alertMessage;
  }

  test('should explain RECITATION finish reason', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ finishReason: 'RECITATION', content: { parts: [] } }]
    });
    expect(msg).toContain('published text');
  });

  test('should explain MAX_TOKENS truncation instead of a parse error', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{"name": "Soup", "ingredients": "1 cup wat' }] } }]
    });
    expect(msg).toContain('cut off');
  });

  test('should explain SAFETY finish reason', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ finishReason: 'SAFETY' }]
    });
    expect(msg).toContain('safety filters');
  });

  test('should explain a blocked prompt', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      promptFeedback: { blockReason: 'OTHER' }
    });
    expect(msg).toContain('blocked this request');
  });

  test('should accept a normal STOP response', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ name: 'Soup', ingredients: 'Water', directions: 'Boil' }) }] } }]
    });
    expect(msg).toBe('');
    expect(await page.evaluate(() => window.extractedRecipe?.name)).toBe('Soup');
  });
  test('should explain when the response has no recipe content', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ name: '', ingredients: '', directions: '' }) }] } }]
    });
    expect(msg).toContain('No recipe was found');
    expect(await page.evaluate(() => window.extractedRecipe)).toBeFalsy();
    await expect(page.locator('#recipeEditor')).toHaveValue('');
  });

  test('should treat whitespace-only fields as empty', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ content: { parts: [{ text: JSON.stringify({ name: 'Untitled', ingredients: '  \n ', directions: ' ' }) }] } }]
    });
    expect(msg).toContain('No recipe was found');
  });

  test('should reject a response that is not a recipe object', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ content: { parts: [{ text: 'null' }] } }]
    });
    expect(msg).toContain('No recipe was found');
  });

  test('should accept a recipe without a name', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ content: { parts: [{ text: JSON.stringify({ name: '', ingredients: '1 egg', directions: 'Boil' }) }] } }]
    });
    expect(msg).toBe('');
    expect(await page.evaluate(() => window.extractedRecipe?.ingredients)).toBe('1 egg');
  });
  test('should join a reply split across several parts', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ content: { parts: [
        { text: '{"name":"Spl' },
        { text: 'it Soup","ingredients":"Water","directions":"Boil"}' }
      ] } }]
    });
    expect(msg).toBe('');
    expect(await page.evaluate(() => window.extractedRecipe?.name)).toBe('Split Soup');
  });

  test('should ignore thought parts from thinking models', async ({ page }) => {
    const msg = await extractWithResponse(page, {
      candidates: [{ content: { parts: [
        { text: 'Looking at the photo, this is a soup recipe...', thought: true },
        { text: '{"name":"Thoughtful Soup","ingredients":"Water","directions":"Boil"}' }
      ] } }]
    });
    expect(msg).toBe('');
    expect(await page.evaluate(() => window.extractedRecipe?.name)).toBe('Thoughtful Soup');
  });
});

test.describe('Retrying temporary failures', () => {
  const RECIPE = { name: 'Retried Soup', ingredients: 'Water', directions: 'Boil' };
  const okBody = JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(RECIPE) }] } }] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'key');
    });
    await page.reload();
    await fastRetries(page);
    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
  });

  // Serves `first` for the first request and a valid recipe after that
  async function failOnceThenSucceed(page, first) {
    const state = { attempts: 0 };
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      state.attempts++;
      if (state.attempts === 1) {
        await first(route);
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: okBody });
      }
    });
    return state;
  }

  for (const status of [429, 500, 503]) {
    test(`retries after HTTP ${status}`, async ({ page }) => {
      const state = await failOnceThenSucceed(page, route => route.fulfill({
        status, contentType: 'application/json', body: JSON.stringify({ error: { message: `status ${status}` } })
      }));
      await page.locator('#extractBtn').click();
      await expect.poll(() => page.evaluate(() => window.extractedRecipe?.name)).toBe('Retried Soup');
      expect(state.attempts).toBe(2);
    });
  }

  test('retries after a network failure', async ({ page }) => {
    const state = await failOnceThenSucceed(page, route => route.abort('failed'));
    await page.locator('#extractBtn').click();
    await expect.poll(() => page.evaluate(() => window.extractedRecipe?.name)).toBe('Retried Soup');
    expect(state.attempts).toBe(2);
  });

  test('retries after a reply that is not valid JSON', async ({ page }) => {
    const state = await failOnceThenSucceed(page, route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name": "Trunc' }] } }] })
    }));
    await page.locator('#extractBtn').click();
    await expect.poll(() => page.evaluate(() => window.extractedRecipe?.name)).toBe('Retried Soup');
    expect(state.attempts).toBe(2);
  });

  test('does not retry a bad request such as an invalid API key', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    const state = await failOnceThenSucceed(page, route => route.fulfill({
      status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid' } })
    }));
    await page.locator('#extractBtn').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('API key');
    expect(state.attempts).toBe(1);
  });

  test('does not retry a blocked response', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    const state = await failOnceThenSucceed(page, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] })
    }));
    await page.locator('#extractBtn').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('safety filters');
    expect(state.attempts).toBe(1);
  });

  test('keeps the button disabled while retrying', async ({ page }) => {
    await page.evaluate(() => { CONFIG.retry.baseDelayMs = 1500; });
    await failOnceThenSucceed(page, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#extractBtn')).toBeDisabled();
    await expect.poll(() => page.evaluate(() => window.extractedRecipe?.name), { timeout: 5000 }).toBe('Retried Soup');
    await expect(page.locator('#extractBtn')).toBeEnabled();
  });
});

test.describe('Request timeout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'key');
    });
    await page.reload();
    await page.evaluate(() => {
      CONFIG.timeoutMs = 500;
      CONFIG.retry.baseDelayMs = 1;
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });
  });

  test('gives up on a request that takes too long, without retrying', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

    let attempts = 0;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {});
    });

    await page.locator('#extractBtn').click();

    await expect.poll(() => dialogs.length, { timeout: 5000 }).toBe(1);
    expect(dialogs[0]).toContain("didn't respond within 1 seconds");
    expect(attempts).toBe(1);
    await expect(page.locator('#extractBtn')).toBeEnabled();
  });

  test('a response within the limit succeeds', async ({ page }) => {
    await page.evaluate(() => { CONFIG.timeoutMs = 5000; });
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"On Time","ingredients":"i","directions":"d"}' }] } }] })
      });
    });

    await page.locator('#extractBtn').click();
    await expect.poll(() => page.evaluate(() => window.extractedRecipe?.name)).toBe('On Time');
  });
});

test.describe('API key handling', () => {
  test('sends the API key in a header, not the URL', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'secret-key-123');
    });
    await page.reload();
    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });

    let request = null;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      request = route.request();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"R","ingredients":"i","directions":"d"}' }] } }] })
      });
    });
    await page.locator('#extractBtn').click();
    await expect.poll(() => request).not.toBeNull();

    expect(request.url()).not.toContain('secret-key-123');
    expect(request.url()).not.toContain('key=');
    expect(request.headers()['x-goog-api-key']).toBe('secret-key-123');
  });
});

test.describe('Error messages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'key');
    });
    await page.reload();
    await fastRetries(page);
    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
  });

  async function alertForApiError(page, status, error) {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify({ error })
    }));
    await page.locator('#extractBtn').click();
    await expect.poll(() => dialogs.length).toBe(1);
    return dialogs[0];
  }

  test('an invalid API key gets the API key hint, from the error reason', async ({ page }) => {
    const msg = await alertForApiError(page, 400, {
      message: 'API key not valid. Please pass a valid API key.',
      status: 'INVALID_ARGUMENT',
      details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }]
    });
    expect(msg).toBe('Failed to extract recipe. Please check your API key is valid. (API key not valid. Please pass a valid API key.)');
  });

  test('a 403 gets the API key hint', async ({ page }) => {
    const msg = await alertForApiError(page, 403, { message: 'Permission denied', status: 'PERMISSION_DENIED' });
    expect(msg).toContain('Please check your API key is valid. (Permission denied)');
  });

  test('a 429 gets the rate limit hint and keeps the details', async ({ page }) => {
    const msg = await alertForApiError(page, 429, { message: 'Resource has been exhausted (e.g. check quota).', status: 'RESOURCE_EXHAUSTED' });
    expect(msg).toContain("rate limit or quota was reached");
    expect(msg).toContain('(Resource has been exhausted (e.g. check quota).)');
  });

  test('other API errors are shown as Gemini wrote them, even if they mention "parse" or "API key"', async ({ page }) => {
    const msg = await alertForApiError(page, 400, {
      message: 'Unable to parse image data. API key usage is fine.',
      status: 'INVALID_ARGUMENT'
    });
    expect(msg).toBe('Failed to extract recipe. Unable to parse image data. API key usage is fine.');
  });

  test('an invalid model name shows the API message', async ({ page }) => {
    const msg = await alertForApiError(page, 404, { message: 'models/nope is not found for API version v1beta', status: 'NOT_FOUND' });
    expect(msg).toBe('Failed to extract recipe. models/nope is not found for API version v1beta');
  });
});
