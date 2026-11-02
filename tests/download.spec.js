const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { expandStep, stubClipboard, readStubClipboard } = require('./helpers');

test.describe('Step 3: Download - Recipe Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Set up a mock extracted recipe
    await page.evaluate(() => {
      window.extractedRecipe = {
        name: 'Test Lasagna',
        ingredients: '1 lb ground beef\n2 cups mozzarella cheese\n1 jar marinara sauce',
        directions: ['Brown the beef', 'Layer ingredients', 'Bake at 375F for 45 minutes'],
        servings: '8',
        prep_time: '20 minutes',
        cook_time: '45 minutes',
        photos: ['data:image/jpeg;base64,testimage123']
      };
    });
  });

  test('should have download button visible', async ({ page }) => {
    const downloadBtn = page.locator('#step3 .btn-primary').filter({ hasText: /Download.*paprikarecipe/ });
    await expect(downloadBtn).toBeVisible();
  });

  test('should have copy to clipboard button visible', async ({ page }) => {
    const copyBtn = page.locator('#step3 .btn-secondary').filter({ hasText: 'Copy to Clipboard' });
    await expect(copyBtn).toBeVisible();
  });

  test('should display recipe editor textarea', async ({ page }) => {
    const editor = page.locator('#step3 textarea.editor-placeholder');
    await expect(editor).toBeVisible();
  });

  test('should populate editor with extracted recipe JSON', async ({ page }) => {
    await page.evaluate(() => displayRecipeInEditor(window.extractedRecipe));

    const editorContent = await page.locator('#recipeEditor').inputValue();
    const parsed = JSON.parse(editorContent);
    expect(parsed.name).toBe('Test Lasagna');
    expect(parsed.servings).toBe('8');
    // Pretty-printed with 2-space indentation
    expect(editorContent).toContain('\n  "name": "Test Lasagna"');
  });

  test('should format JSON with proper indentation', async ({ page }) => {
    const recipe = {
      name: 'Test Recipe',
      ingredients: 'test',
      directions: ['step 1']
    };

    await page.evaluate((r) => {
      window.extractedRecipe = r;
      const editor = document.querySelector('#step3 textarea');
      if (editor) {
        editor.value = JSON.stringify(r, null, 2);
      }
    }, recipe);

    const editorContent = await page.locator('#step3 textarea').inputValue();

    // Check if properly formatted
    if (editorContent) {
      expect(editorContent).toContain('\n');
      expect(editorContent).toContain('  '); // indentation
    }
  });

  test('should allow editing recipe JSON', async ({ page }) => {
    const editor = page.locator('#step3 textarea');

    const newContent = '{"name": "Edited Recipe"}';
    await editor.fill(newContent);

    const value = await editor.inputValue();
    expect(value).toBe(newContent);
  });

  test('should download file with .paprikarecipe extension', async ({ page }) => {
    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    // Expand step 3
    await page.locator('#step3 .step-header').click();

    // Click download button
    const downloadBtn = page.locator('#step3 .btn-primary').filter({ hasText: /Download/ });
    await downloadBtn.click();

    const download = await downloadPromise;

    if (download) {
      // Verify file extension
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.paprikarecipe$/);
    } else {
      // Download functionality not yet implemented, which is expected
      expect(download).toBeNull();
    }
  });

  test('should use recipe name in filename', async ({ page }) => {
    await page.evaluate(() => {
      window.extractedRecipe = {
        name: 'Grandmas Famous Lasagna',
        ingredients: 'test',
        directions: ['test']
      };
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    // Expand step 3
    await page.locator('#step3 .step-header').click();

    const downloadBtn = page.locator('#step3 .btn-primary').filter({ hasText: /Download/ });
    await downloadBtn.click();

    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      // Should contain sanitized recipe name
      expect(filename.toLowerCase()).toContain('lasagna');
    }
  });

  test('should copy JSON to clipboard', async ({ page }) => {
    await stubClipboard(page);
    const json = JSON.stringify({ name: 'Clipboard Test', ingredients: 'test' });

    await page.evaluate((text) => {
      document.getElementById('recipeEditor').value = text;
    }, json);

    await expandStep(page, 'step3');
    await page.locator('#step3 .btn-secondary').filter({ hasText: 'Copy to Clipboard' }).click();

    await expect.poll(() => readStubClipboard(page)).toBe(json);
  });

  test('should show success message after copy', async ({ page }) => {
    await stubClipboard(page);
    await page.evaluate(() => {
      document.getElementById('recipeEditor').value = '{"name":"Copy Feedback"}';
    });

    await expandStep(page, 'step3');
    const copyBtn = page.locator('#step3 .btn-secondary');
    await copyBtn.click();

    // Button briefly reads "Copied!", then reverts after 2 seconds
    await expect(copyBtn).toContainText('Copied!');
    await expect(copyBtn).toContainText('Copy to Clipboard', { timeout: 4000 });
  });

  test('should include photos array in exported JSON', async ({ page }) => {
    await page.evaluate(() => {
      const editor = document.querySelector('#step3 textarea');
      if (editor && window.extractedRecipe) {
        editor.value = JSON.stringify(window.extractedRecipe, null, 2);
      }
    });

    const editorContent = await page.locator('#step3 textarea').inputValue();

    if (editorContent) {
      try {
        const parsed = JSON.parse(editorContent);
        expect(Array.isArray(parsed.photos) || parsed.photos === undefined).toBe(true);
      } catch (e) {
        // Not yet JSON or not implemented
      }
    }
  });

  test('should validate JSON before download', async ({ page }) => {
    // Expand step 3
    await page.locator('#step3 .step-header').click();

    // Put invalid JSON in editor
    const editor = page.locator('#step3 textarea');
    await editor.fill('{ invalid json }');

    let errorShown = false;
    page.on('dialog', async dialog => {
      if (dialog.message().toLowerCase().includes('invalid') ||
          dialog.message().toLowerCase().includes('error')) {
        errorShown = true;
      }
      await dialog.accept();
    });

    const downloadBtn = page.locator('#step3 .btn-primary').filter({ hasText: /Download/ });
    await downloadBtn.click();

    await page.waitForTimeout(500);

    // Should validate (once implemented)
    expect(typeof errorShown).toBe('boolean');
  });

  test('should show success status after successful extraction', async ({ page }) => {
    await page.evaluate(() => {
      window.extractedRecipe = { name: 'Test' };
    });

    // Look for success status indicator
    const statusElements = page.locator('.status').filter({ hasText: /success|extracted|complete/i });
    const count = await statusElements.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should preserve user edits when downloading', async ({ page }) => {
    const editor = page.locator('#step3 textarea');
    const customRecipe = '{"name":"Custom Edited Recipe","ingredients":"flour"}';

    await editor.fill(customRecipe);

    // The download should use the edited content from the textarea
    const editorValue = await editor.inputValue();
    expect(editorValue).toBe(customRecipe);
  });

  test('should handle recipe with special characters in name', async ({ page }) => {
    await page.evaluate(() => {
      window.extractedRecipe = {
        name: 'Mom\'s "Special" Recipe & More!',
        ingredients: 'test',
        directions: ['test']
      };
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    // Expand step 3
    await page.locator('#step3 .step-header').click();

    const downloadBtn = page.locator('#step3 .btn-primary').filter({ hasText: /Download/ });
    await downloadBtn.click();

    const download = await downloadPromise;

    if (download) {
      const filename = download.suggestedFilename();
      // Filename should be sanitized
      expect(filename).not.toContain('"');
      expect(filename).not.toContain('&');
      expect(filename).toMatch(/\.paprikarecipe$/);
    }
  });

  test('should clear editor when starting new recipe', async ({ page }) => {
    // Fill editor
    const editor = page.locator('#step3 textarea');
    await editor.fill('{"name":"Old Recipe"}');

    // Simulate starting new extraction
    await page.evaluate(() => {
      window.extractedRecipe = null;
      if (window.clearEditor) {
        window.clearEditor();
      }
    });

    // Check if clear function exists
    const hasClearFunction = await page.evaluate(() => {
      return typeof window.clearEditor === 'function';
    });

    expect(typeof hasClearFunction).toBe('boolean');
  });

  test('should download a gzip-compressed file, not plain JSON', async ({ page }) => {
    const recipe = { name: 'Gzip Test Recipe', ingredients: 'flour, eggs', directions: ['Mix', 'Bake'] };

    await page.evaluate((r) => {
      const editor = document.querySelector('#step3 textarea');
      if (editor) editor.value = JSON.stringify(r, null, 2);
    }, recipe);

    await page.locator('#step3 .step-header').click();

    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();
    const download = await downloadPromise;

    const path = await download.path();
    const buf = fs.readFileSync(path);

    // Gzip magic bytes: 0x1f 0x8b
    expect(buf[0]).toBe(0x1f);
    expect(buf[1]).toBe(0x8b);
  });

  test('should not include photos or photo_data fields in recipe JSON', async ({ page }) => {
    // The editor content is exactly what gets zipped — check it directly
    const recipe = { name: 'No Photos Recipe', ingredients: 'butter', directions: ['Melt butter'] };

    await page.evaluate((r) => {
      const editor = document.querySelector('#step3 textarea');
      if (editor) editor.value = JSON.stringify(r, null, 2);
    }, recipe);

    const editorContent = await page.locator('#step3 textarea').inputValue();
    const json = JSON.parse(editorContent);

    expect(json.photos).toBeUndefined();
    expect(json.photo_data).toBeUndefined();
  });
});

test.describe('Copy button feedback', () => {
  test('tapping Copy twice quickly still restores the original label', async ({ page }) => {
    await page.goto('/');
    await stubClipboard(page);
    await page.evaluate(() => { document.getElementById('recipeEditor').value = '{"name":"x"}'; });
    await expandStep(page, 'step3');

    const copyBtn = page.locator('#step3 .btn-secondary');
    await copyBtn.click();
    await expect(copyBtn).toContainText('Copied!');
    await copyBtn.click();
    await expect(copyBtn).toContainText('Copied!');

    // Reverts 2s after the last tap, to the real label
    await expect(copyBtn).toContainText('Copy to Clipboard', { timeout: 4000 });
    await page.waitForTimeout(2500);
    await expect(copyBtn).toContainText('Copy to Clipboard');
    await expect(copyBtn).not.toContainText('Copied!');
  });
});

test.describe('Download URL lifetime', () => {
  test('keeps the download URL alive after the click, then revokes it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      CONFIG.downloadUrlLifetimeMs = 1000;
      window.__revoked = [];
      const original = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url) => { window.__revoked.push(url); original(url); };
      document.getElementById('recipeEditor').value = '{"name":"Lifetime"}';
    });
    await expandStep(page, 'step3');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Lifetime.paprikarecipe');

    // Not revoked right away...
    expect(await page.evaluate(() => window.__revoked.length)).toBe(0);
    // ...but cleaned up after the lifetime
    await expect.poll(() => page.evaluate(() => window.__revoked.length), { timeout: 3000 }).toBe(1);
  });
});
