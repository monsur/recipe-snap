const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Step 2: Upload - Image Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      window.uploadedImages = [];
    });
  });

  test('should have upload buttons visible', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const takePhotoBtn = page.locator('.upload-option-btn').filter({ hasText: 'Take Photo' });
    const uploadPhotosBtn = page.locator('.upload-option-btn').filter({ hasText: 'Upload Photos' });

    await expect(takePhotoBtn).toBeVisible();
    await expect(uploadPhotosBtn).toBeVisible();
  });

  test('should have extract recipe button', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const extractBtn = page.locator('#step2 .btn-primary').filter({ hasText: 'Extract Recipe' });
    await expect(extractBtn).toBeVisible();
  });

  test('should accept image file uploads', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const fileInput = page.locator('input[type="file"]');

    // Upload a test image (setInputFiles automatically triggers change event)
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));

    // Wait for processing to complete
    await page.waitForFunction(() => {
      return window.uploadedImages && window.uploadedImages.length > 0;
    }, { timeout: 5000 });

    // Verify image was uploaded
    const imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(1);

    // Verify preview grid is now visible
    const previewGrid = page.locator('#previewGrid');
    await expect(previewGrid).toBeVisible();
  });

  test('should hide preview grid when no photos are uploaded', async ({ page }) => {
    // Expand step 2 to properly test that the preview grid is hidden
    await page.locator('#step2 .step-header').click();

    const previewGrid = page.locator('#previewGrid');
    await expect(previewGrid).not.toBeVisible();
  });

  test('should store uploaded images in memory', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Verify array starts empty
    let imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(0);

    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));

    // Wait for upload to complete
    await page.waitForFunction(() => window.uploadedImages.length > 0, { timeout: 5000 });

    // Verify image is stored
    imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(1);

    // Verify it's a base64 data URL
    const imageData = await page.evaluate(() => window.uploadedImages[0]);
    expect(imageData).toMatch(/^data:image\/(jpeg|png);base64,/);
  });

  test('should have preview grid container for future uploads', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // This test verifies the preview grid container exists in the DOM
    // Preview items will be dynamically created when images are uploaded
    const previewGrid = page.locator('#previewGrid');
    await expect(previewGrid).toBeAttached();
  });

  test('should not download the HEIC library on page load', async ({ page }) => {
    const heicRequests = [];
    page.on('request', r => { if (r.url().includes('heic-to')) heicRequests.push(r.url()); });
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(heicRequests).toEqual([]);
    expect(await page.evaluate(() => typeof HeicTo)).toBe('undefined');
  });

  test('should resize images to max 1600px', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Upload large test image (2000x2000)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-large.png'));

    // Wait for processing
    await page.waitForFunction(() => window.uploadedImages.length > 0, { timeout: 5000 });

    // Verify image was resized by checking the base64 data URL
    const imageDimensions = await page.evaluate(() => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.width, height: img.height });
        };
        img.src = window.uploadedImages[0];
      });
    });

    // Image should be resized to fit within 1600px (maintaining aspect ratio)
    expect(Math.max(imageDimensions.width, imageDimensions.height)).toBeLessThanOrEqual(1600);
  });

  test('should convert images to base64', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Upload test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));

    // Wait for processing
    await page.waitForFunction(() => window.uploadedImages.length > 0, { timeout: 5000 });

    // Verify image is stored as base64 data URL
    const imageData = await page.evaluate(() => window.uploadedImages[0]);

    // Should be a data URL with base64 encoding
    expect(imageData).toMatch(/^data:image\/(jpeg|png);base64,/);

    // Should contain base64 data
    const base64Data = imageData.split(',')[1];
    expect(base64Data.length).toBeGreaterThan(100);

    // Verify it's valid base64
    expect(base64Data).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test('should allow removing uploaded images', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));

    // Wait for upload
    await page.waitForFunction(() => window.uploadedImages.length > 0, { timeout: 5000 });

    // Verify image count
    let imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(1);

    // Verify preview item appears
    await expect(page.locator('.preview-item')).toBeVisible();

    // Click delete button on preview item
    await page.locator('.preview-item-delete').click();

    // Wait for removal
    await page.waitForFunction(() => window.uploadedImages.length === 0, { timeout: 1000 });

    // Verify image was removed
    imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(0);

    // Verify preview grid is hidden
    await expect(page.locator('#previewGrid')).not.toBeVisible();
  });

  test('should show preview grid after uploading images', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    // Preview grid should be hidden initially
    await expect(page.locator('#previewGrid')).not.toBeVisible();

    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));

    // Wait for upload
    await page.waitForFunction(() => window.uploadedImages.length > 0, { timeout: 5000 });

    // Preview grid should now be visible
    await expect(page.locator('#previewGrid')).toBeVisible();

    // Should have one preview item
    const previewItems = page.locator('.preview-item');
    await expect(previewItems).toHaveCount(1);

    // Preview item should contain an image
    await expect(previewItems.locator('img')).toBeVisible();

    // Preview item should have a delete button
    await expect(previewItems.locator('.preview-item-delete')).toBeVisible();
  });

  test('should handle multiple image uploads', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const fileInput = page.locator('input[type="file"]');

    // Upload two images
    await fileInput.setInputFiles([
      path.join(__dirname, 'fixtures/test-image-small.png'),
      path.join(__dirname, 'fixtures/test-image-large.png')
    ]);
    // Note: setInputFiles should automatically trigger the change event
    // No need to manually dispatch

    // Wait for both to be processed
    await page.waitForFunction(() => window.uploadedImages.length === 2, { timeout: 10000 });

    // Add a small delay to ensure processing is fully complete
    await page.waitForTimeout(500);

    // Verify both images are stored
    const imageCount = await page.evaluate(() => {
      console.log('DEBUG: uploadedImages.length =', window.uploadedImages.length);
      console.log('DEBUG: preview items =', document.querySelectorAll('.preview-item').length);
      return window.uploadedImages.length;
    });
    expect(imageCount).toBe(2);

    // Verify two preview items
    const previewItems = page.locator('.preview-item');
    await expect(previewItems).toHaveCount(2);
  });

  test('should show processing message in correct button during upload', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const takePhotoBtn = page.locator('.upload-option-btn').filter({ hasText: 'Take Photo' });
    const uploadPhotosBtn = page.locator('#uploadBtn');

    // Verify both buttons are visible initially
    await expect(takePhotoBtn).toBeVisible();
    await expect(uploadPhotosBtn).toBeVisible();

    // Set up a promise to track the button state during processing
    const processingStatePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const uploadBtn = document.getElementById('uploadBtn');
        const takePhotoBtn = document.querySelector('.upload-option-btn');

        // Store original content
        const originalUploadBtnContent = uploadBtn.innerHTML;
        const originalTakePhotoBtnContent = takePhotoBtn.innerHTML;

        // Set up a MutationObserver to watch for changes
        const states = {
          uploadBtnShowedProcessing: false,
          takePhotoBtnShowedProcessing: false
        };

        const observer = new MutationObserver(() => {
          if (uploadBtn.innerHTML.includes('Processing')) {
            states.uploadBtnShowedProcessing = true;
          }
          if (takePhotoBtn.innerHTML.includes('Processing')) {
            states.takePhotoBtnShowedProcessing = true;
          }
        });

        observer.observe(uploadBtn, { childList: true, subtree: true });
        observer.observe(takePhotoBtn, { childList: true, subtree: true });

        // Wait for upload to complete, then resolve
        const checkInterval = setInterval(() => {
          if (window.uploadedImages && window.uploadedImages.length > 0) {
            clearInterval(checkInterval);
            observer.disconnect();
            resolve(states);
          }
        }, 50);
      });
    });

    // Trigger file upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));

    // Wait for processing to complete and get the states
    const states = await processingStatePromise;

    // Verify "Upload Photos" button showed processing message
    expect(states.uploadBtnShowedProcessing).toBe(true);

    // Verify "Take Photo" button did NOT show processing message
    expect(states.takePhotoBtnShowedProcessing).toBe(false);

    // Verify upload completed successfully
    await page.waitForFunction(() => window.uploadedImages.length > 0, { timeout: 5000 });
    const imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(1);
  });
});

test.describe('Images sent to Gemini', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('geminiApiKey', 'key');
    });
    await page.reload();
  });

  // Makes a solid-colour JPEG of the given size, in the browser
  async function makeJpeg(page, width, height) {
    const base64 = await page.evaluate(([w, h]) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#c33';
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL('image/jpeg', 0.8).split(',')[1];
    }, [width, height]);
    return Buffer.from(base64, 'base64');
  }

  // Uploads one file, runs an extraction, and returns the image part sent
  // to Gemini along with its decoded size
  async function uploadAndCaptureImage(page, file) {
    await page.locator('#fileInput').setInputFiles(file);
    await expect(page.locator('.preview-item')).toHaveCount(1);

    let parts = null;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      parts = route.request().postDataJSON().contents[0].parts.filter(p => p.inlineData);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"R","ingredients":"i","directions":"d"}' }] } }] })
      });
    });
    await page.locator('#extractBtn').click();
    await expect.poll(() => parts).not.toBeNull();

    const { mimeType, data } = parts[0].inlineData;
    const size = await page.evaluate(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = src;
    }), `data:${mimeType};base64,${data}`);
    return { mimeType, data, ...size };
  }

  // Base64 of the JPEG signature (FF D8 FF) starts with /9j/
  const isJpegData = data => data.startsWith('/9j/');

  test('a JPEG that already fits is sent unchanged, byte for byte', async ({ page }) => {
    const jpeg = await makeJpeg(page, 800, 600);
    const sent = await uploadAndCaptureImage(page, { name: 'small.jpg', mimeType: 'image/jpeg', buffer: jpeg });

    expect(sent.mimeType).toBe('image/jpeg');
    expect(sent.data).toBe(jpeg.toString('base64'));
  });

  test('a large JPEG is scaled to 1600px on its longest side', async ({ page }) => {
    const jpeg = await makeJpeg(page, 3200, 2000);
    const sent = await uploadAndCaptureImage(page, { name: 'big.jpg', mimeType: 'image/jpeg', buffer: jpeg });

    expect(sent.mimeType).toBe('image/jpeg');
    expect(isJpegData(sent.data)).toBe(true);
    expect([sent.width, sent.height]).toEqual([1600, 1000]);
  });

  test('a small PNG is converted to JPEG without being enlarged', async ({ page }) => {
    const sent = await uploadAndCaptureImage(page, path.join(__dirname, 'fixtures', 'test-image-small.png'));

    expect(sent.mimeType).toBe('image/jpeg');
    expect(isJpegData(sent.data)).toBe(true);
    expect([sent.width, sent.height]).toEqual([100, 100]);
  });

  test('a large PNG is converted to JPEG and scaled to 1600px', async ({ page }) => {
    const sent = await uploadAndCaptureImage(page, path.join(__dirname, 'fixtures', 'test-image-large.png'));

    expect(sent.mimeType).toBe('image/jpeg');
    expect(isJpegData(sent.data)).toBe(true);
    expect([sent.width, sent.height]).toEqual([1600, 1600]);
  });

  test('every image is encoded at most once', async ({ page }) => {
    await page.evaluate(() => {
      window.__encodeCount = 0;
      const original = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        window.__encodeCount++;
        return original.apply(this, args);
      };
    });

    await page.locator('#fileInput').setInputFiles([
      path.join(__dirname, 'fixtures', 'test-image-small.png'),
      path.join(__dirname, 'fixtures', 'test-image-large.png')
    ]);
    await expect(page.locator('.preview-item')).toHaveCount(2);

    expect(await page.evaluate(() => window.__encodeCount)).toBe(2);
  });
});

test.describe('File type handling', () => {
  // 1x1 WebP and GIF images
  const WEBP_1PX = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=', 'base64');
  const GIF_1PX = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#step2 .step-header').click();
  });

  test('unsupported files are reported, supported ones in the batch are still added', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

    await page.locator('#fileInput').setInputFiles([
      { name: 'test-image-small.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(__dirname, 'fixtures/test-image-small.png')) },
      { name: 'animation.gif', mimeType: 'image/gif', buffer: GIF_1PX }
    ]);

    await expect(page.locator('.preview-item')).toHaveCount(1);
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('animation.gif');
    expect(dialogs[0]).toContain('unsupported file type');
    expect(dialogs[0]).toContain('Supported formats: JPG, PNG, WebP, HEIC');
    expect(dialogs[0]).not.toContain('test-image-small.png');
  });

  test('no alert when every file is supported', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

    await page.locator('#fileInput').setInputFiles(path.join(__dirname, 'fixtures/test-image-small.png'));
    await expect(page.locator('.preview-item')).toHaveCount(1);
    await page.waitForTimeout(200);
    expect(dialogs).toEqual([]);
  });

  test('WebP files are accepted and sent as JPEG', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('geminiApiKey', 'key'));

    await page.locator('#fileInput').setInputFiles({ name: 'photo.webp', mimeType: 'image/webp', buffer: WEBP_1PX });
    await expect(page.locator('.preview-item')).toHaveCount(1);

    let parts = null;
    await page.route('**/generativelanguage.googleapis.com/**', async route => {
      parts = route.request().postDataJSON().contents[0].parts.filter(p => p.inlineData);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"R","ingredients":"i","directions":"d"}' }] } }] })
      });
    });
    await page.locator('#extractBtn').click();
    await expect.poll(() => parts).not.toBeNull();
    expect(parts[0].inlineData.mimeType).toBe('image/jpeg');
  });
});

test.describe('HEIC conversion (library loaded on demand)', () => {
  // Stand-in for the heic-to library: decodes any input to a 2400x1800
  // bitmap, and records the options it was called with
  const FAKE_HEIC_LIBRARY = `
    window.__heicCalls = [];
    window.HeicTo = async (options) => {
      window.__heicCalls.push({ type: options.type });
      const c = document.createElement('canvas');
      c.width = 2400; c.height = 1800;
      c.getContext('2d').fillRect(0, 0, 2400, 1800);
      return createImageBitmap(c);
    };`;
  const heicFile = name => ({ name, mimeType: 'image/heic', buffer: Buffer.from('not really heic') });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#step2 .step-header').click();
  });

  test('loads the library on the first HEIC upload, once', async ({ page }) => {
    let libraryRequests = 0;
    await page.route('**/heic-to@*/**', route => {
      libraryRequests++;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_HEIC_LIBRARY });
    });

    await page.locator('#fileInput').setInputFiles(heicFile('a.heic'));
    await expect(page.locator('.preview-item')).toHaveCount(1);
    await page.locator('#fileInput').setInputFiles(heicFile('b.HEIF'));
    await expect(page.locator('.preview-item')).toHaveCount(2);

    expect(libraryRequests).toBe(1);
    const types = await page.evaluate(() => window.uploadedImages.map(d => d.split(';')[0]));
    expect(types).toEqual(['data:image/jpeg', 'data:image/jpeg']);
  });

  test('decodes straight to a bitmap and encodes once, at 1600px', async ({ page }) => {
    await page.route('**/heic-to@*/**', route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_HEIC_LIBRARY }));

    await page.locator('#fileInput').setInputFiles(heicFile('photo.heic'));
    await expect(page.locator('.preview-item')).toHaveCount(1);

    // Asked for a bitmap, not an intermediate JPEG
    expect(await page.evaluate(() => window.__heicCalls)).toEqual([{ type: 'bitmap' }]);

    const size = await page.evaluate(() => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.src = window.uploadedImages[0];
    }));
    expect(size).toEqual([1600, 1200]);
  });

  test('reports a failed library download and retries on the next upload', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

    let fail = true;
    await page.route('**/heic-to@*/**', route => (fail
      ? route.fulfill({ status: 503, body: '' })
      : route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_HEIC_LIBRARY })));

    await page.locator('#fileInput').setInputFiles(heicFile('photo.heic'));
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toContain('photo.heic');
    expect(dialogs[0]).toContain('could not be loaded');
    await expect(page.locator('.preview-item')).toHaveCount(0);

    fail = false;
    await page.locator('#fileInput').setInputFiles(heicFile('photo.heic'));
    await expect(page.locator('.preview-item')).toHaveCount(1);
  });
});
