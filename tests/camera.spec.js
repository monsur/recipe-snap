const { test, expect } = require('@playwright/test');

test.describe('Take Photo Camera Feature', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant camera permissions
    await context.grantPermissions(['camera']);

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      window.uploadedImages = [];
      window.cameraState = {
        stream: null,
        facingMode: 'environment',
        capturedPhotos: [],
        hasMultipleCameras: false
      };
    });

    // Mock getUserMedia for camera access
    await page.addInitScript(() => {
      // Create a mock video stream
      const mockVideoTrack = {
        kind: 'video',
        label: 'Mock Camera',
        enabled: true,
        readyState: 'live',
        stop: () => {},
        getSettings: () => ({
          width: 1920,
          height: 1080
        })
      };

      const mockStream = {
        getVideoTracks: () => [mockVideoTrack],
        getTracks: () => [mockVideoTrack],
        active: true
      };

      // Mock getUserMedia
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        console.log('Mock getUserMedia called with:', constraints);
        return mockStream;
      };

      // Mock enumerateDevices
      navigator.mediaDevices.enumerateDevices = async () => {
        return [
          { kind: 'videoinput', label: 'Front Camera', deviceId: 'front' },
          { kind: 'videoinput', label: 'Back Camera', deviceId: 'back' }
        ];
      };
    });
  });

  // Camera Modal UI Tests
  test('should open camera modal when Take Photo button clicked', async ({ page }) => {
    // Expand step 2
    await page.locator('#step2 .step-header').click();

    const takePhotoBtn = page.locator('#takePhotoBtn');
    const cameraModal = page.locator('#cameraModal');

    // Click Take Photo button
    await takePhotoBtn.click();

    // Wait for modal to be visible
    await expect(cameraModal).toBeVisible({ timeout: 5000 });
  });

  test('should display camera controls and video preview', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });

    // Check for video preview
    const video = page.locator('#cameraVideo');
    await expect(video).toBeVisible();

    // Check for controls
    const captureBtn = page.locator('#cameraCaptureBtn');
    const doneBtn = page.locator('#cameraDoneBtn');
    await expect(captureBtn).toBeVisible();
    await expect(doneBtn).toBeVisible();
  });

  test('should show camera switch button when multiple cameras available', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });

    // Wait for camera initialization
    await page.waitForTimeout(500);

    // Check if switch button is visible
    const switchBtn = page.locator('#cameraSwitchBtn');
    const isVisible = await switchBtn.isVisible();

    // Should be visible because mock returns 2 cameras
    expect(isVisible).toBe(true);
  });

  test('should close camera modal when close button clicked', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });

    const closeBtn = page.locator('.camera-modal-close');
    await closeBtn.click();

    const cameraModal = page.locator('#cameraModal');
    await expect(cameraModal).not.toBeVisible();
  });

  test('should close camera modal when ESC key pressed', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });

    // Press ESC key
    await page.keyboard.press('Escape');

    const cameraModal = page.locator('#cameraModal');
    await expect(cameraModal).not.toBeVisible();
  });

  // Camera Access Tests
  test('should have camera state initialized', async ({ page }) => {
    await page.locator('#step2 .step-header').click();

    const cameraState = await page.evaluate(() => window.cameraState);

    expect(cameraState).toBeDefined();
    expect(cameraState.facingMode).toBe('environment');
    expect(cameraState.capturedPhotos).toEqual([]);
    expect(cameraState.stream).toBeNull();
  });

  test('should detect multiple cameras', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    const hasMultipleCameras = await page.evaluate(() => window.cameraState.hasMultipleCameras);
    expect(hasMultipleCameras).toBe(true);
  });

  // Photo Capture Tests
  test('should capture photo when capture button clicked', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video ready state
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 }); // HAVE_ENOUGH_DATA
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    const captureBtn = page.locator('#cameraCaptureBtn');
    await captureBtn.click();

    await page.waitForTimeout(200);

    const capturedPhotos = await page.evaluate(() => window.cameraState.capturedPhotos.length);
    expect(capturedPhotos).toBe(1);
  });

  test('should display captured photo in session thumbnails', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video ready state
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 });
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    await page.locator('#cameraCaptureBtn').click();
    await page.waitForTimeout(200);

    const sessionThumbnails = page.locator('#cameraSessionThumbnails');
    await expect(sessionThumbnails).toBeVisible();

    const thumbnails = page.locator('.camera-session-thumbnail');
    await expect(thumbnails).toHaveCount(1);
  });

  test('should allow capturing multiple photos in session', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video ready state
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 });
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    // Capture 3 photos
    const captureBtn = page.locator('#cameraCaptureBtn');
    await captureBtn.click();
    await page.waitForTimeout(200);
    await captureBtn.click();
    await page.waitForTimeout(200);
    await captureBtn.click();
    await page.waitForTimeout(200);

    const capturedPhotos = await page.evaluate(() => window.cameraState.capturedPhotos.length);
    expect(capturedPhotos).toBe(3);

    const thumbnails = page.locator('.camera-session-thumbnail');
    await expect(thumbnails).toHaveCount(3);
  });

  // Session Management Tests
  test('should allow removing photos from session', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video and capture 2 photos
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 });
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    await page.locator('#cameraCaptureBtn').click();
    await page.waitForTimeout(200);
    await page.locator('#cameraCaptureBtn').click();
    await page.waitForTimeout(200);

    // Remove first photo
    const removeBtn = page.locator('.camera-session-thumbnail-remove').first();
    await removeBtn.click();

    const capturedPhotos = await page.evaluate(() => window.cameraState.capturedPhotos.length);
    expect(capturedPhotos).toBe(1);
  });

  test('should process and add photos to main upload array', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video and capture a photo
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 });
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    await page.locator('#cameraCaptureBtn').click();
    await page.waitForTimeout(200);

    // Click Done button
    await page.locator('#cameraDoneBtn').click();
    await page.waitForTimeout(1000);

    // Check if photo was added to uploadedImages
    const imageCount = await page.evaluate(() => window.uploadedImages.length);
    expect(imageCount).toBe(1);

    // Check if modal closed
    const cameraModal = page.locator('#cameraModal');
    await expect(cameraModal).not.toBeVisible();
  });

  test('should update main preview grid after processing', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video and capture a photo
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 });
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    await page.locator('#cameraCaptureBtn').click();
    await page.waitForTimeout(200);

    await page.locator('#cameraDoneBtn').click();
    await page.waitForTimeout(1000);

    // Check if preview grid is visible
    const previewGrid = page.locator('#previewGrid');
    await expect(previewGrid).toBeVisible();

    // Check if preview item exists
    const previewItems = page.locator('.preview-item');
    await expect(previewItems).toHaveCount(1);
  });

  test('should clear session thumbnails on new camera open', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    // Mock video and capture a photo
    await page.evaluate(() => {
      const video = document.getElementById('cameraVideo');
      Object.defineProperty(video, 'readyState', { value: 4 });
      Object.defineProperty(video, 'videoWidth', { value: 1920 });
      Object.defineProperty(video, 'videoHeight', { value: 1080 });
    });

    await page.locator('#cameraCaptureBtn').click();
    await page.waitForTimeout(200);

    // Close modal without processing
    await page.locator('.camera-modal-close').click();

    // Reopen camera
    await page.locator('#takePhotoBtn').click();
    await page.waitForSelector('#cameraModal', { state: 'visible' });
    await page.waitForTimeout(500);

    const capturedPhotos = await page.evaluate(() => window.cameraState.capturedPhotos.length);
    expect(capturedPhotos).toBe(0);
  });

  // Integration Tests
  test('should work alongside file upload feature', async ({ page }) => {
    await page.locator('#step2 .step-header').click();

    const takePhotoBtn = page.locator('#takePhotoBtn');
    const uploadPhotosBtn = page.locator('#uploadBtn');

    await expect(takePhotoBtn).toBeVisible();
    await expect(uploadPhotosBtn).toBeVisible();
  });

  test('should have proper ARIA labels on modal and buttons', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });

    const modal = page.locator('#cameraModal');
    const role = await modal.getAttribute('role');
    const ariaModal = await modal.getAttribute('aria-modal');

    expect(role).toBe('dialog');
    expect(ariaModal).toBe('true');

    const closeBtn = page.locator('.camera-modal-close');
    const ariaLabel = await closeBtn.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });

  test('should close modal when Done clicked with no photos', async ({ page }) => {
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();

    await page.waitForSelector('#cameraModal', { state: 'visible' });

    await page.locator('#cameraDoneBtn').click();

    const cameraModal = page.locator('#cameraModal');
    await expect(cameraModal).not.toBeVisible();
  });
});
