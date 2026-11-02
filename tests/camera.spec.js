const { test, expect } = require('@playwright/test');

/**
 * Opens step 2, taps "Take Photo", and waits until the mock camera is
 * streaming frames so captures will succeed.
 */
async function openCameraReady(page) {
  if (await page.locator('#step2').evaluate(el => el.classList.contains('collapsed'))) {
    await page.locator('#step2 .step-header').click();
  }
  await page.locator('#takePhotoBtn').click();
  await expect(page.locator('#cameraModal')).toBeVisible();
  await page.waitForFunction(() => document.getElementById('cameraVideo').readyState >= 4);
}

async function capture(page, expectedTotal) {
  await page.locator('#cameraCaptureBtn').click();
  await expect.poll(() => page.evaluate(() => window.cameraState.capturedPhotos.length)).toBe(expectedTotal);
}

test.describe('Take Photo Camera Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Install a fake camera before the app loads. The stream comes from an
    // animated canvas, so it is a real MediaStream that a <video> can play
    // and capturePhoto() can draw from, in every browser.
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      let hue = 0;
      setInterval(() => {
        ctx.fillStyle = `hsl(${hue = (hue + 10) % 360}, 60%, 50%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }, 50);

      // Patch the prototype rather than navigator.mediaDevices itself:
      // WebKit can swap in a fresh MediaDevices object, dropping
      // instance-level overrides.
      MediaDevices.prototype.getUserMedia = async () => canvas.captureStream(20);
      MediaDevices.prototype.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Front Camera', deviceId: 'front' },
        { kind: 'videoinput', label: 'Back Camera', deviceId: 'back' }
      ];
    });

    await page.goto('/');
  });

  // Camera Modal UI Tests
  test('should open camera modal when Take Photo button clicked', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();
    await expect(page.locator('#cameraModal')).toBeVisible({ timeout: 5000 });
  });

  test('should display camera controls and video preview', async ({ page }) => {
    await openCameraReady(page);

    await expect(page.locator('#cameraVideo')).toBeVisible();
    await expect(page.locator('#cameraCaptureBtn')).toBeVisible();
    await expect(page.locator('#cameraDoneBtn')).toBeVisible();
    await expect(page.locator('#cameraError')).toBeHidden();
  });

  test('should show camera switch button when multiple cameras available', async ({ page }) => {
    await openCameraReady(page);
    await expect(page.locator('#cameraSwitchBtn')).toBeVisible();
  });

  test('should close camera modal when close button clicked', async ({ page }) => {
    await openCameraReady(page);
    await page.locator('.camera-modal-close').click();
    await expect(page.locator('#cameraModal')).not.toBeVisible();
  });

  test('should close camera modal when ESC key pressed', async ({ page }) => {
    await openCameraReady(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#cameraModal')).not.toBeVisible();
  });

  // Camera Access Tests
  test('should have camera state initialized', async ({ page }) => {
    const cameraState = await page.evaluate(() => window.cameraState);

    expect(cameraState).toBeDefined();
    expect(cameraState.facingMode).toBe('environment');
    expect(cameraState.capturedPhotos).toEqual([]);
    expect(cameraState.stream).toBeNull();
  });

  test('should detect multiple cameras', async ({ page }) => {
    await openCameraReady(page);
    expect(await page.evaluate(() => window.cameraState.hasMultipleCameras)).toBe(true);
  });

  // Photo Capture Tests
  test('should capture photo when capture button clicked', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);

    const photo = await page.evaluate(() => window.cameraState.capturedPhotos[0]);
    expect(photo).toMatch(/^data:image\/jpeg;base64,/);
  });

  test('should display captured photo in session thumbnails', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);

    await expect(page.locator('#cameraSessionThumbnails')).toBeVisible();
    await expect(page.locator('.camera-session-thumbnail')).toHaveCount(1);
  });

  test('should allow capturing multiple photos in session', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);
    await capture(page, 2);
    await capture(page, 3);

    await expect(page.locator('.camera-session-thumbnail')).toHaveCount(3);
  });

  // Session Management Tests
  test('should allow removing photos from session', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);
    await capture(page, 2);

    await page.locator('.camera-session-thumbnail-remove').first().click();

    expect(await page.evaluate(() => window.cameraState.capturedPhotos.length)).toBe(1);
    await expect(page.locator('.camera-session-thumbnail')).toHaveCount(1);
  });

  test('should process and add photos to main upload array', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);

    await page.locator('#cameraDoneBtn').click();

    await expect(page.locator('#cameraModal')).not.toBeVisible();
    expect(await page.evaluate(() => window.uploadedImages.length)).toBe(1);
  });

  test('should update main preview grid after processing', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);
    await capture(page, 2);

    await page.locator('#cameraDoneBtn').click();

    await expect(page.locator('#previewGrid')).toBeVisible();
    await expect(page.locator('.preview-item')).toHaveCount(2);
  });

  test('should clear session thumbnails on new camera open', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);

    // Close modal without processing, then reopen
    await page.locator('.camera-modal-close').click();
    await openCameraReady(page);

    expect(await page.evaluate(() => window.cameraState.capturedPhotos.length)).toBe(0);
    await expect(page.locator('.camera-session-thumbnail')).toHaveCount(0);
  });

  // Integration Tests
  test('should work alongside file upload feature', async ({ page }) => {
    await page.locator('#step2 .step-header').click();

    await expect(page.locator('#takePhotoBtn')).toBeVisible();
    await expect(page.locator('#uploadBtn')).toBeVisible();
  });

  test('should have proper ARIA labels on modal and buttons', async ({ page }) => {
    await openCameraReady(page);

    const modal = page.locator('#cameraModal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.camera-modal-close')).toHaveAttribute('aria-label', /.+/);
  });

  test('should close modal when Done clicked with no photos', async ({ page }) => {
    await openCameraReady(page);
    await page.locator('#cameraDoneBtn').click();
    await expect(page.locator('#cameraModal')).not.toBeVisible();
  });

  test('should reset Done button after processing so the next session can submit', async ({ page }) => {
    // First session: capture and submit
    await openCameraReady(page);
    await capture(page, 1);
    await page.locator('#cameraDoneBtn').click();
    await expect(page.locator('#cameraModal')).not.toBeVisible();

    // Done button should be back to its normal state
    const doneBtn = page.locator('#cameraDoneBtn');
    await expect(doneBtn).toBeEnabled();
    await expect(doneBtn).not.toContainText('Processing');
    await expect(doneBtn.locator('polyline')).toHaveCount(1);

    // Second session (e.g. after "Start New Recipe") should also submit
    await page.locator('.btn-reset').click();
    await openCameraReady(page);
    await capture(page, 1);
    await doneBtn.click();
    await expect(page.locator('#cameraModal')).not.toBeVisible();
    expect(await page.evaluate(() => window.uploadedImages.length)).toBe(1);
  });
});
