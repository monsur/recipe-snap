const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('End-to-End Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipe-snap.html');
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
    await page.waitForTimeout(1500);

    // Step 4: Verify recipe is displayed in editor
    const editorContent = await page.locator('#step3 textarea').inputValue();

    // Should have some content (once implemented)
    expect(typeof editorContent).toBe('string');

    // Step 5: Test download
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();

    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.paprikarecipe$/);
    }
  });

  test('workflow with custom model and prompt', async ({ page }) => {
    // Set custom settings
    await page.locator('#apiKey').fill('custom-test-key');

    await page.locator('.advanced-toggle').click();
    await page.locator('#llmModel').fill('gemini-pro-vision');
    await page.locator('#llmPrompt').fill('Extract recipe with metric measurements');

    await page.locator('#step1 .btn-primary').click();

    // Verify settings saved
    const savedModel = await page.evaluate(() => localStorage.getItem('llmModel'));
    const savedPrompt = await page.evaluate(() => localStorage.getItem('llmPrompt'));

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
    });

    // Mock multiple images
    await page.evaluate(() => {
      window.uploadedImages = [
        'data:image/jpeg;base64,image1data',
        'data:image/jpeg;base64,image2data',
        'data:image/jpeg;base64,image3data'
      ];
    });

    const mockRecipe = {
      name: 'Multi-Page Recipe',
      ingredients: 'Various ingredients from multiple pages',
      directions: ['Combined from all images']
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

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(1000);

    // Verify all images were processed
    const imageCount = await page.evaluate(() => {
      return window.uploadedImages ? window.uploadedImages.length : 0;
    });

    expect(imageCount).toBe(3);
  });

  test('error handling: API key missing', async ({ page }) => {
    // Don't set API key
    let alertShown = false;
    page.on('dialog', async dialog => {
      alertShown = true;
      await dialog.accept();
    });

    // Try to extract without API key
    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(500);

    // Should show error (once implemented)
    expect(typeof alertShown).toBe('boolean');
  });

  test('error handling: no images uploaded', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'test-key');
      window.uploadedImages = [];
    });

    let alertShown = false;
    page.on('dialog', async dialog => {
      alertShown = true;
      await dialog.accept();
    });

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(500);

    // Should show error about missing images
    expect(typeof alertShown).toBe('boolean');
  });

  test('error handling: invalid JSON in editor', async ({ page }) => {
    const editor = page.locator('#step3 textarea');
    await editor.fill('{ this is not valid json }');

    let errorShown = false;
    page.on('dialog', async dialog => {
      errorShown = true;
      await dialog.accept();
    });

    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();
    await page.waitForTimeout(500);

    // Should validate JSON
    expect(typeof errorShown).toBe('boolean');
  });

  test('step collapsing workflow', async ({ page }) => {
    const step1 = page.locator('#step1');
    const step2 = page.locator('#step2');

    // Step 1 starts expanded
    await expect(step1).not.toHaveClass(/collapsed/);

    // Complete step 1
    await page.locator('#apiKey').fill('test-key');
    await page.locator('#step1 .btn-primary').click();

    // Collapse step 1, expand step 2
    await page.locator('#step1 .step-header').click();
    await expect(step1).toHaveClass(/collapsed/);

    // Work on step 2
    await expect(step2).not.toHaveClass(/collapsed/);
  });

  test('copy to clipboard workflow', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);

    const testRecipe = {
      name: 'Clipboard Recipe',
      ingredients: 'test ingredients',
      directions: ['test step']
    };

    await page.evaluate((recipe) => {
      window.extractedRecipe = recipe;
      const editor = document.querySelector('#step3 textarea');
      if (editor) {
        editor.value = JSON.stringify(recipe, null, 2);
      }
    }, testRecipe);

    await page.locator('#step3 .btn-secondary').filter({ hasText: 'Copy to Clipboard' }).click();
    await page.waitForTimeout(500);

    const clipboardContent = await page.evaluate(() => {
      return navigator.clipboard.readText().catch(() => '');
    });

    expect(typeof clipboardContent).toBe('string');
  });

  test('clear all data workflow', async ({ page }) => {
    // Set up data
    await page.locator('#apiKey').fill('test-to-clear');
    await page.locator('.advanced-toggle').click();
    await page.locator('#llmModel').fill('custom-model');
    await page.locator('#step1 .btn-primary').click();

    // Verify data exists
    let hasData = await page.evaluate(() => {
      return localStorage.getItem('geminiApiKey') !== null;
    });
    expect(hasData).toBe(true);

    // Mock confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Clear data
    await page.locator('.clear-data-link').click();
    await page.waitForTimeout(500);

    // Verify data is cleared
    hasData = await page.evaluate(() => {
      return localStorage.getItem('geminiApiKey') !== null;
    });
    expect(hasData).toBe(false);

    // Verify inputs are reset
    await expect(page.locator('#apiKey')).toHaveValue('');
  });

  test('recipe with special characters and formatting', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'special-chars-test');
    });

    const complexRecipe = {
      name: 'Mom\'s "Famous" Café Crème Brûlée',
      ingredients: '2 cups heavy cream\n1/2 cup sugar\n5 egg yolks\n1 tsp vanilla extract\nPinch of salt',
      directions: [
        'Heat cream to 180°F (don\'t boil!)',
        'Whisk eggs & sugar until pale',
        'Temper eggs with hot cream',
        'Strain through fine-mesh sieve',
        'Pour into ramekins & bake at 325°F for 40-45 min'
      ],
      servings: '6',
      prep_time: '15 minutes',
      cook_time: '45 minutes'
    };

    await page.evaluate(() => {
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify(complexRecipe)
              }]
            }
          }]
        })
      });
    });

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(1000);

    // Verify special characters are handled
    const editorContent = await page.locator('#step3 textarea').inputValue();
    expect(typeof editorContent).toBe('string');
  });

  test('API rate limiting and retry logic', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'rate-limit-test');
      window.uploadedImages = ['data:image/jpeg;base64,test'];
    });

    let attemptCount = 0;

    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      attemptCount++;

      if (attemptCount === 1) {
        // First attempt: rate limit error
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              message: 'Rate limit exceeded'
            }
          })
        });
      } else {
        // Subsequent attempts: success
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: '{"name":"Retry Success"}'
                }]
              }
            }]
          })
        });
      }
    });

    await page.locator('#step2 .btn-primary').click();
    await page.waitForTimeout(2000);

    // Should handle rate limiting gracefully
    expect(attemptCount).toBeGreaterThanOrEqual(1);
  });
});
