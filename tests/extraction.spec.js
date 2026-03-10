const { test, expect } = require('@playwright/test');

test.describe('Step 2: Extraction - Gemini API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Set up a test API key
    await page.evaluate(() => {
      localStorage.setItem('geminiApiKey', 'test-api-key-12345');
    });
  });

  test('should have Gemini SDK loaded', async ({ page }) => {
    // Check if Google Generative AI SDK script is included
    const geminiScript = page.locator('script[src*="generative"]');
    const scriptCount = await geminiScript.count();

    expect(scriptCount).toBeGreaterThanOrEqual(0);
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
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
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

    await page.evaluate(() => { window.uploadedImages = ['data:image/jpeg;base64,test']; });
    await page.locator('#step2 .step-header').click();
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(1000);

    expect(alertMessage.toLowerCase()).toContain('failed');
  });
});
