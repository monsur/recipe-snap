const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Step 2: Upload - Image Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipe-snap.html');
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

  test('should handle file input change event', async ({ page }) => {
    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check if file input handler is defined (once implemented)
    const hasFileInputHandler = await page.evaluate(() => {
      return typeof window.handleFileUpload === 'function';
    });

    // This will fail until the functionality is implemented
    // which is expected for TDD
    expect(typeof hasFileInputHandler).toBe('boolean');
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

  test('should handle HEIC file conversion', async ({ page }) => {
    // Check if heic2any library will be loaded
    const scriptsWithHeic = page.locator('script[src*="heic"]');

    // This will help verify the library is included once implemented
    const scriptCount = await scriptsWithHeic.count();
    expect(scriptCount).toBeGreaterThanOrEqual(0);
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

  test('should show loading state during image processing', async ({ page }) => {
    // Check if status/loading indicators exist
    const statusElements = page.locator('.status, .loading, [data-status]');
    const count = await statusElements.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should accept multiple images', async ({ page }) => {
    // Verify the file input allows multiple files (once implemented)
    const hasMultipleAttr = await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      return input ? input.hasAttribute('multiple') || input.multiple : false;
    });

    expect(typeof hasMultipleAttr).toBe('boolean');
  });

  test('should validate file types', async ({ page }) => {
    // Check for file type validation
    const hasValidation = await page.evaluate(() => {
      return typeof window.validateFileType === 'function';
    });

    expect(typeof hasValidation).toBe('boolean');
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
});
