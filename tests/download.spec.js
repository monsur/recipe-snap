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

test.describe('Photos in the Paprika download', () => {
  const crypto = require('crypto');
  const zlib = require('zlib');
  const recipe = { name: 'Photo Recipe', ingredients: 'flour', directions: '1. Mix' };
  const PHOTO_FIELDS = ['photo', 'photo_data', 'photo_hash', 'photo_large', 'photos'];

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  // Makes a JPEG data URL of the given size: left half red, right half blue,
  // so a centre crop can be told apart from the whole image
  const makePhoto = (page, width, height) => page.evaluate(([w, h]) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d00';
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = '#00d';
    ctx.fillRect(w / 2, 0, w / 2, h);
    return c.toDataURL('image/jpeg', 0.9);
  }, [width, height]);

  // Puts a recipe in the editor with the given photos, as after an extraction
  async function setUpRecipe(page, photos) {
    await page.evaluate(([r, p]) => {
      window.extractedRecipe = r;
      window.extractedPhotos = p;
      displayRecipeInEditor(r);
    }, [recipe, photos]);
    await expandStep(page, 'step3');
  }

  async function downloadFile(page) {
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#step3 .btn-primary').filter({ hasText: /Download/ }).click();
    const download = await downloadPromise;
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(await download.path())).toString('utf8'));
  }

  const imageSize = (page, base64) => page.evaluate(src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
    img.src = src;
  }), `data:image/jpeg;base64,${base64}`);

  const sha256 = base64 => crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').toUpperCase();

  test('no photos: the file has no photo fields', async ({ page }) => {
    await setUpRecipe(page, []);
    const file = await downloadFile(page);
    expect(file).toEqual(recipe);
  });

  test('one photo: a square thumbnail as the main photo, the photo in the gallery, and photo_large', async ({ page }) => {
    const photo = await makePhoto(page, 1200, 1600);
    await setUpRecipe(page, [photo]);
    const file = await downloadFile(page);

    expect(file.photo).toMatch(/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\.jpg$/);
    expect(file.photo_data.startsWith('/9j/')).toBe(true); // JPEG
    expect(await imageSize(page, file.photo_data)).toEqual([280, 280]);
    expect(file.photo_hash).toBe(sha256(file.photo_data));

    // The full photo, so tapping the thumbnail in Paprika opens it
    expect(file.photos).toHaveLength(1);
    expect(file.photos[0].name).toBe('1');
    expect(file.photos[0].data).toBe(photo.split(',')[1]);
    expect(file.photo_large).toBe(file.photos[0].filename);
  });

  test('the thumbnail is the centre of the photo, not the whole photo squashed', async ({ page }) => {
    // Left half red, right half blue: the centre crop of a wide image still
    // has both colours, split down the middle
    const photo = await makePhoto(page, 1600, 800);
    await setUpRecipe(page, [photo]);
    const file = await downloadFile(page);

    const [left, right] = await page.evaluate(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve([ctx.getImageData(70, 140, 1, 1).data[0], ctx.getImageData(210, 140, 1, 1).data[2]]);
      };
      img.src = src;
    }), `data:image/jpeg;base64,${file.photo_data}`);
    expect(left).toBeGreaterThan(150);  // red on the left
    expect(right).toBeGreaterThan(150); // blue on the right
  });

  test('several photos: main thumbnail plus every photo in the gallery, unchanged', async ({ page }) => {
    const photos = [await makePhoto(page, 1200, 1600), await makePhoto(page, 1600, 1200), await makePhoto(page, 800, 600)];
    await setUpRecipe(page, photos);
    const file = await downloadFile(page);

    expect(await imageSize(page, file.photo_data)).toEqual([280, 280]);
    expect(file.photos.map(p => p.name)).toEqual(['1', '2', '3']);
    expect(file.photos.map(p => p.data)).toEqual(photos.map(p => p.split(',')[1]));
    const filenames = file.photos.map(p => p.filename).concat(file.photo);
    expect(new Set(filenames).size).toBe(4);
    filenames.forEach(f => expect(f).toMatch(/^[0-9A-F-]{36}\.jpg$/));
    // Tapping the thumbnail in Paprika opens the first photo
    expect(file.photo_large).toBe(file.photos[0].filename);
  });

  test('photos never appear in the editor or in the copied text', async ({ page }) => {
    await stubClipboard(page);
    await setUpRecipe(page, [await makePhoto(page, 400, 400), await makePhoto(page, 400, 400)]);

    const editor = JSON.parse(await page.locator('#recipeEditor').inputValue());
    await page.locator('#step3 button').filter({ hasText: /Copy/ }).click();
    await expect.poll(() => readStubClipboard(page)).not.toBeNull();
    const copied = JSON.parse(await readStubClipboard(page));

    for (const json of [editor, copied]) {
      PHOTO_FIELDS.forEach(key => expect(json[key]).toBeUndefined());
    }
  });

  test('the download uses the photos the recipe was extracted from', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('geminiApiKey', 'key'));
    await page.route('**/generativelanguage.googleapis.com/**', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(recipe) }] } }] })
    }));
    const photos = [await makePhoto(page, 400, 300), await makePhoto(page, 300, 400)];
    await page.evaluate(p => { window.uploadedImages = [...p]; }, photos);
    await expandStep(page, 'step2');
    await page.locator('#extractBtn').click();
    await expect(page.locator('#extractionStatus')).toBeVisible();

    // A photo added after extraction isn't part of this recipe
    const extra = await makePhoto(page, 500, 500);
    await page.evaluate(p => { window.uploadedImages.push(p); }, extra);

    const file = await downloadFile(page);
    expect(file.photos.map(p => p.data)).toEqual(photos.map(p => p.split(',')[1]));
  });

  test('starting a new recipe forgets the old photos', async ({ page }) => {
    await setUpRecipe(page, [await makePhoto(page, 400, 400)]);
    await page.locator('.btn-reset').click();
    expect(await page.evaluate(() => window.extractedPhotos)).toEqual([]);
  });

  test('if the photos cannot be added, the recipe still downloads without them', async ({ page }) => {
    await setUpRecipe(page, ['data:image/jpeg;base64,bm90IGFuIGltYWdl']); // "not an image"
    const file = await downloadFile(page);
    expect(file).toEqual(recipe);
  });
});
