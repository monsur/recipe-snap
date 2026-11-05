const { test, expect } = require('@playwright/test');
const fs = require('fs');
const zlib = require('zlib');
const { expandStep, stubClipboard, readStubClipboard, collectDialogs, fastRetries, clickClearAllData } = require('./helpers');

test.describe('End-to-End Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('complete workflow: setup → upload → extract → download', async ({ page }) => {
    // Step 1: Setup API Key
    const apiKey = 'test-integration-key-12345';
    await page.locator('#apiKey').fill(apiKey);
    await page.locator('#step1 .btn-primary').click();

    // Verify stored
    const storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    expect(storedKey).toBe(apiKey);

    // Step 2: Mock image upload
    await page.evaluate(() => {
      window.uploadedImages = [
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k='
      ];
    });

    // Step 3: Mock Gemini API response
    const mockRecipe = {
      name: 'Integration Test Lasagna',
      ingredients: '1 lb ground beef\n2 cups mozzarella cheese\n1 jar marinara sauce\n12 lasagna noodles',
      directions: [
        'Brown the ground beef in a large skillet',
        'Cook lasagna noodles according to package directions',
        'Layer noodles, meat, sauce, and cheese in a 9x13 pan',
        'Bake at 375F for 45 minutes',
        'Let rest 10 minutes before serving'
      ],
      servings: '8',
      prep_time: '20 minutes',
      cook_time: '45 minutes'
    };

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

    // Click extract
    await page.locator('#step2 .btn-primary').click();

    // Step 4: Step 3 opens with the success message and the extracted recipe
    await expect(page.locator('#extractionStatus')).toBeVisible();
    await expect(page.locator('#extractionStatus')).toContainText('Recipe extracted successfully');
    await expect(page.locator('#step3')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#step2')).toHaveClass(/collapsed/);

    const editorContent = await page.locator('#recipeEditor').inputValue();
    expect(JSON.parse(editorContent)).toEqual(mockRecipe);

    // Step 5: Download produces a gzipped .paprikarecipe holding the same recipe
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/lasagna.*\.paprikarecipe$/i);
    const downloaded = JSON.parse(zlib.gunzipSync(fs.readFileSync(await download.path())).toString('utf8'));
    const { photo, photo_data, photo_hash, photos, photo_large, ...recipeOnly } = downloaded;
    expect(recipeOnly).toEqual(mockRecipe);

    // The one uploaded photo becomes the main photo and the gallery's only photo
    expect(photo).toMatch(/^[0-9A-F-]{36}\.jpg$/);
    expect(photo_data).toBeTruthy();
    expect(photo_hash).toMatch(/^[0-9A-F]{64}$/);
    expect(photos).toHaveLength(1);
    expect(photo_large).toBe(photos[0].filename);
  });

  test('workflow with custom model and prompt', async ({ page }) => {
    // Set custom settings
    await page.locator('#apiKey').fill('custom-test-key');

    await page.locator('.advanced-toggle').click();
    await page.locator('#model').fill('gemini-pro-vision');
    await page.locator('#prompt').fill('Extract recipe with metric measurements');

    await page.locator('#step1 .btn-primary').click();

    // Verify settings saved
    const savedModel = await page.evaluate(() => localStorage.getItem('model'));
    const savedPrompt = await page.evaluate(() => localStorage.getItem('prompt'));

    expect(savedModel).toBe('gemini-pro-vision');
    expect(savedPrompt).toBe('Extract recipe with metric measurements');
  });

  test('workflow persistence across page reload', async ({ page }) => {
    // Save API key
    const apiKey = 'persistent-key-test';
    await page.locator('#apiKey').fill(apiKey);
    await page.locator('#step1 .btn-primary').click();

    // Reload page
    await page.reload();

    // Verify API key is still loaded
    const loadedKey = await page.locator('#apiKey').inputValue();
    expect(loadedKey).toBe(apiKey);
  });

  test('workflow with multiple images', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'multi-image-test');
      window.uploadedImages = [
        'data:image/jpeg;base64,image1data',
        'data:image/jpeg;base64,image2data',
        'data:image/jpeg;base64,image3data'
      ];
    });

    const mockRecipe = {
      name: 'Multi-Page Recipe',
      ingredients: 'Various ingredients from multiple pages',
      directions: 'Combined from all images'
    };

    let requestBody = null;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(mockRecipe) }] } }] })
      });
    });

    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();
    await expect.poll(() => page.evaluate(() => window.extractedRecipe?.name)).toBe('Multi-Page Recipe');

    // All three images were sent in a single request, after the prompt
    const parts = requestBody.contents[0].parts;
    const imageParts = parts.filter(p => p.inlineData);
    expect(imageParts.map(p => p.inlineData.data)).toEqual(['image1data', 'image2data', 'image3data']);
  });

  test('error handling: API key missing', async ({ page }) => {
    const dialogs = collectDialogs(page);
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();

    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('API key');
  });

  test('error handling: no images uploaded', async ({ page }) => {
    const dialogs = collectDialogs(page);
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'test-key');
      window.uploadedImages = [];
    });

    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();

    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('upload');
  });

  test('error handling: invalid JSON in editor', async ({ page }) => {
    const dialogs = collectDialogs(page);
    await expandStep(page, 'step3');
    await page.locator('#recipeEditor').fill('{ this is not valid json }');

    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();

    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('Invalid JSON');
  });

  test('step collapsing workflow', async ({ page }) => {
    const step1 = page.locator('#step1');
    const step2 = page.locator('#step2');

    // With no saved API key, step 1 starts expanded and step 2 collapsed
    await expect(step1).not.toHaveClass(/collapsed/);
    await expect(step2).toHaveClass(/collapsed/);

    // Saving settings collapses step 1 and opens step 2
    await page.locator('#apiKey').fill('test-key');
    await page.locator('#step1 .btn-primary').click();
    await expect(step1).toHaveClass(/collapsed/);
    await expect(step2).not.toHaveClass(/collapsed/);

    // Clicking a step header toggles it
    await page.locator('#step1 .step-header').click();
    await expect(step1).not.toHaveClass(/collapsed/);
    await page.locator('#step1 .step-header').click();
    await expect(step1).toHaveClass(/collapsed/);
  });

  test('copy to clipboard workflow', async ({ page }) => {
    await stubClipboard(page);

    const testRecipe = {
      name: 'Clipboard Recipe',
      ingredients: 'test ingredients',
      directions: 'test step'
    };
    const json = JSON.stringify(testRecipe, null, 2);

    await page.evaluate((text) => {
      document.getElementById('recipeEditor').value = text;
    }, json);

    await expandStep(page, 'step3');
    await page.locator('#step3 .btn-secondary').filter({ hasText: 'Copy to Clipboard' }).click();

    await expect.poll(() => readStubClipboard(page)).toBe(json);
  });

  test('clear all data workflow', async ({ page }) => {
    // Set up data
    await page.locator('#apiKey').fill('test-to-clear');
    await page.locator('.advanced-toggle').click();
    await page.locator('#model').fill('custom-model');
    await page.locator('#step1 .btn-primary').click();

    expect(await page.evaluate(() => localStorage.getItem('geminiApiKey'))).toBe('test-to-clear');

    // Accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Saving collapsed step 1; reopen it to reach the clear-data link
    await expandStep(page, 'step1');
    await clickClearAllData(page);

    await expect.poll(() => page.evaluate(() => localStorage.getItem('geminiApiKey'))).toBeNull();
    await expect(page.locator('#apiKey')).toHaveValue('');
    await expect(page.locator('#model')).toHaveValue(await page.evaluate(() => CONFIG.defaults.model));
  });

  test('recipe with special characters and formatting', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'special-chars-test');
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    const complexRecipe = {
      name: 'Mom\'s "Famous" Café Crème Brûlée',
      ingredients: '2 cups heavy cream\n1/2 cup sugar\n5 egg yolks\n1 tsp vanilla extract\nPinch of salt',
      directions: 'Heat cream to 180°F (don\'t boil!)\nWhisk eggs & sugar until pale\nTemper eggs with hot cream',
      servings: '6',
      prep_time: '15 minutes',
      cook_time: '45 minutes'
    };

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(complexRecipe) }] } }] })
      });
    });

    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();

    // Editor shows the recipe with every character intact
    await expect(page.locator('#recipeEditor')).not.toHaveValue('');
    const parsed = JSON.parse(await page.locator('#recipeEditor').inputValue());
    expect(parsed.name).toBe(complexRecipe.name);
    expect(parsed.ingredients).toBe(complexRecipe.ingredients);
    expect(parsed.directions).toBe(complexRecipe.directions);
  });

  test('API rate limiting retries, then shows an error', async ({ page }) => {
    const dialogs = collectDialogs(page);
    await fastRetries(page);
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'rate-limit-test');
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    let attemptCount = 0;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      attemptCount++;
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Rate limit exceeded' } })
      });
    });

    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();

    // Retried up to the limit, then the user sees the API's message
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('Rate limit exceeded');
    expect(attemptCount).toBe(3);
    await expect(page.locator('#extractBtn')).toBeEnabled();
  });

  test('reset button is visible on the page', async ({ page }) => {
    const resetBtn = page.locator('.btn-reset');
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toContainText('Start New Recipe');
  });

  test('reset clears uploaded images', async ({ page }) => {
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,abc123'];
    });

    let count = await page.evaluate(() => window.uploadedImages.length);
    expect(count).toBe(1);

    await page.locator('.btn-reset').click();

    count = await page.evaluate(() => window.uploadedImages.length);
    expect(count).toBe(0);
  });

  test('reset clears recipe editor and extractedRecipe', async ({ page }) => {
    await page.evaluate(() => {
      window.extractedRecipe = { name: 'Old Recipe' };
      document.getElementById('recipeEditor').value = '{"name":"Old Recipe"}';
    });

    await page.locator('.btn-reset').click();

    const editorValue = await page.locator('#recipeEditor').inputValue();
    expect(editorValue).toBe('');

    const extracted = await page.evaluate(() => window.extractedRecipe);
    expect(extracted).toBeNull();
  });

  test('reset does not clear the API key', async ({ page }) => {
    const apiKey = 'keep-this-key';
    await page.evaluate((key) => localStorage.setItem('geminiApiKey', key), apiKey);
    await page.evaluate(() => {
      document.getElementById('apiKey').value = 'keep-this-key';
    });

    await page.locator('.btn-reset').click();

    const storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    expect(storedKey).toBe(apiKey);

    const inputValue = await page.locator('#apiKey').inputValue();
    expect(inputValue).toBe(apiKey);
  });

  test('reset hides extraction status', async ({ page }) => {
    await page.evaluate(() => {
      document.getElementById('extractionStatus').style.display = 'flex';
    });

    await page.locator('.btn-reset').click();

    const display = await page.evaluate(() => {
      return document.getElementById('extractionStatus').style.display;
    });
    expect(display).toBe('none');
  });

  test('source is injected into extracted recipe JSON when set', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'test-source-key');
      localStorage.setItem('source', 'My Cookbook');
    });
    await page.reload();
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,/9j/test'];
    });

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ name: 'Source Test Recipe', ingredients: 'flour', directions: ['mix'] })
              }]
            }
          }]
        })
      });
    });

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(1500);

    const extracted = await page.evaluate(() => window.extractedRecipe);
    expect(extracted).not.toBeNull();
    expect(extracted.source).toBe('My Cookbook');
  });

  test('source is not injected when field is empty', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'test-no-source-key');
      localStorage.removeItem('source');
    });
    await page.reload();
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,/9j/test'];
    });

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({ name: 'No Source Recipe', ingredients: 'flour', directions: ['mix'] })
              }]
            }
          }]
        })
      });
    });

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(1500);

    const extracted = await page.evaluate(() => window.extractedRecipe);
    expect(extracted).not.toBeNull();
    // source should not be set (or remain as whatever Gemini returned, but not overridden)
    expect(extracted.source).toBeFalsy();
  });
});

test.describe('Clear all data', () => {
  test('also clears the recipe, editor, and status, and returns to setup', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'key');
    });
    await page.reload();

    // Simulate a finished extraction
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,abc'];
      updatePreviewGrid();
      const recipe = { name: 'Leftover', ingredients: 'i', directions: 'd' };
      window.extractedRecipe = recipe;
      displayRecipeInEditor(recipe);
      document.getElementById('extractionStatus').style.display = 'flex';
      document.getElementById('step2').classList.add('collapsed');
      document.getElementById('step3').classList.remove('collapsed');
    });

    page.on('dialog', d => d.accept());
    await expandStep(page, 'step1');
    await page.locator('.advanced-toggle').click();
    await clickClearAllData(page);

    await expect(page.locator('#recipeEditor')).toHaveValue('');
    await expect(page.locator('#extractionStatus')).toBeHidden();
    await expect(page.locator('#previewGrid')).toBeHidden();
    expect(await page.evaluate(() => [window.extractedRecipe, window.uploadedImages.length])).toEqual([null, 0]);

    await expect(page.locator('#step1')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#step2')).toHaveClass(/collapsed/);
    await expect(page.locator('#step3')).toHaveClass(/collapsed/);
  });

  test('cancelling the confirmation changes nothing', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'key');
      document.getElementById('recipeEditor').value = '{"name":"Keep"}';
    });

    page.on('dialog', d => d.dismiss());
    await page.locator('.advanced-toggle').click();
    await clickClearAllData(page);

    await expect(page.locator('#recipeEditor')).toHaveValue('{"name":"Keep"}');
    expect(await page.evaluate(() => localStorage.getItem('geminiApiKey'))).toBe('key');
  });
});

test.describe('Extraction success status', () => {
  const recipe = { name: 'Status Test', ingredients: 'flour', directions: ['Mix'] };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'test-key');
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });
  });

  function mockGemini(page, status, body) {
    return page.route('**/generativelanguage.googleapis.com/**', route =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
  }

  test('is hidden before any extraction', async ({ page }) => {
    await expect(page.locator('#extractionStatus')).toBeHidden();
  });

  test('is shown after a successful extraction', async ({ page }) => {
    await mockGemini(page, 200, { candidates: [{ content: { parts: [{ text: JSON.stringify(recipe) }] } }] });
    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();

    await expect(page.locator('#extractionStatus')).toBeVisible();
  });

  test('stays hidden when extraction fails', async ({ page }) => {
    const dialogs = collectDialogs(page);
    await mockGemini(page, 400, { error: { message: 'Bad request', status: 'INVALID_ARGUMENT' } });
    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();

    await expect.poll(() => dialogs.length).toBe(1);
    await expect(page.locator('#extractionStatus')).toBeHidden();
  });
});
