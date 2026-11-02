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

  test('starts the preview explicitly, muted (iOS may not autoplay a camera stream)', async ({ page }) => {
    await page.evaluate(() => {
      window.__playCalls = 0;
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this.id === 'cameraVideo') window.__playCalls++;
        return original.call(this);
      };
    });

    await openCameraReady(page);
    expect(await page.evaluate(() => window.__playCalls)).toBe(1);
    expect(await page.locator('#cameraVideo').evaluate(v => v.muted)).toBe(true);
    expect(await page.locator('#cameraVideo').evaluate(v => v.paused)).toBe(false);

    // Switching cameras starts the new stream too
    await page.locator('#cameraSwitchBtn').click();
    await expect.poll(() => page.evaluate(() => window.__playCalls)).toBe(2);
    expect(await page.locator('#cameraVideo').evaluate(v => v.paused)).toBe(false);
  });

  test('on a phone, the preview fills its box and the buttons stay on screen', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 659 });
    const rect = sel => page.locator(sel).evaluate(el => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    });
    const expectPreviewFillsBox = async () => {
      expect(await rect('#cameraVideo')).toEqual(await rect('.camera-video-container'));
      expect((await rect('.camera-controls')).bottom).toBeLessThanOrEqual(659);
      expect((await rect('#cameraDoneBtn')).right).toBeLessThanOrEqual(393);
    };

    await openCameraReady(page);
    await expectPreviewFillsBox();

    // Thumbnails take space from the preview, not from the buttons
    await capture(page, 1);
    await expectPreviewFillsBox();

    // Reopening gives the same layout as the first time
    const firstOpen = await rect('.camera-video-container');
    await page.locator('.camera-modal-close').click();
    await openCameraReady(page);
    expect(await rect('.camera-video-container')).toEqual(firstOpen);
    await expectPreviewFillsBox();
  });

  test('on a desktop, the preview keeps its 4:3 box', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openCameraReady(page);
    const box = await page.locator('.camera-video-container').boundingBox();
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
    expect(await page.locator('#cameraVideo').boundingBox()).toEqual(box);
  });

  test('Done is hidden until a photo is taken', async ({ page }) => {
    await openCameraReady(page);
    const doneBtn = page.locator('#cameraDoneBtn');
    await expect(doneBtn).toBeHidden();

    await capture(page, 1);
    await expect(doneBtn).toBeVisible();
  });

  test('Done hides again when every photo is removed', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);
    await expect(page.locator('#cameraDoneBtn')).toBeVisible();

    await page.locator('.camera-session-thumbnail-remove').click();
    await expect(page.locator('#cameraDoneBtn')).toBeHidden();
  });

  test('Done is hidden again when the camera is reopened', async ({ page }) => {
    await openCameraReady(page);
    await capture(page, 1);
    await page.locator('.camera-modal-close').click();
    await expect(page.locator('#cameraModal')).toBeHidden();

    await openCameraReady(page);
    await expect(page.locator('#cameraDoneBtn')).toBeHidden();
  });

  test('hiding Done does not move the shutter button', async ({ page }) => {
    await openCameraReady(page);
    const before = await page.locator('#cameraCaptureBtn').boundingBox();
    await capture(page, 1);
    await expect(page.locator('#cameraDoneBtn')).toBeVisible();
    const after = await page.locator('#cameraCaptureBtn').boundingBox();
    expect(after.x).toBeCloseTo(before.x, 0);
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

test.describe('Closing the camera while it is starting', () => {
  test.beforeEach(async ({ page }) => {
    // Slow fake camera: each getUserMedia call resolves (or rejects) after
    // window.__gumDelay ms. Every stream handed out is kept in window.__streams.
    await page.addInitScript(() => {
      window.__gumDelay = 800;
      window.__gumError = null;
      window.__streams = [];
      MediaDevices.prototype.getUserMedia = () => new Promise((resolve, reject) => {
        setTimeout(() => {
          if (window.__gumError) {
            const err = new Error(window.__gumError);
            err.name = 'NotAllowedError';
            reject(err);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 48;
          canvas.getContext('2d').fillRect(0, 0, 64, 48);
          const stream = canvas.captureStream(10);
          window.__streams.push(stream);
          resolve(stream);
        }, window.__gumDelay);
      });
      MediaDevices.prototype.enumerateDevices = async () => [{ kind: 'videoinput', deviceId: 'a', label: 'A' }];
    });
    await page.goto('/');
    await page.locator('#step2 .step-header').click();
  });

  const trackStates = page => page.evaluate(() => window.__streams.map(s => s.getVideoTracks()[0].readyState));

  test('releases the camera if closed before it started', async ({ page }) => {
    await page.locator('#takePhotoBtn').click();
    await expect(page.locator('#cameraModal')).toBeVisible();
    await page.locator('.camera-modal-close').click();

    // Let the slow request finish
    await expect.poll(() => page.evaluate(() => window.__streams.length)).toBe(1);

    expect(await trackStates(page)).toEqual(['ended']);
    expect(await page.evaluate(() => document.getElementById('cameraVideo').srcObject)).toBeNull();
    expect(await page.evaluate(() => window.cameraState.stream)).toBeNull();
    await expect(page.locator('#cameraModal')).toBeHidden();
    await expect(page.locator('#takePhotoBtn')).toBeEnabled();
    await expect(page.locator('#takePhotoBtn')).toContainText('Take Photo');
  });

  test('does not reopen to show an error if closed before the camera failed', async ({ page }) => {
    await page.evaluate(() => { window.__gumError = 'denied'; });
    await page.locator('#takePhotoBtn').click();
    await page.locator('.camera-modal-close').click();

    await page.waitForTimeout(1200);
    await expect(page.locator('#cameraModal')).toBeHidden();
    await expect(page.locator('#takePhotoBtn')).toBeEnabled();
  });

  test('reopening quickly uses the new stream and releases the stale one', async ({ page }) => {
    await page.locator('#takePhotoBtn').click();
    await page.locator('.camera-modal-close').click();

    // Second open resolves after the first
    await page.evaluate(() => { window.__gumDelay = 1200; });
    await page.locator('#takePhotoBtn').click();

    await expect.poll(() => page.evaluate(() => window.__streams.length), { timeout: 5000 }).toBe(2);
    await expect.poll(() => page.evaluate(() => !!window.cameraState.stream)).toBe(true);

    expect(await trackStates(page)).toEqual(['ended', 'live']);
    const attached = await page.evaluate(() => document.getElementById('cameraVideo').srcObject === window.__streams[1]);
    expect(attached).toBe(true);
    await expect(page.locator('#cameraModal')).toBeVisible();
  });
});

test.describe('Switching cameras', () => {
  test.beforeEach(async ({ page }) => {
    // Fake front/back cameras. Modes listed in window.__failingModes reject.
    // Every stream handed out is recorded with its mode in window.__streams.
    await page.addInitScript(() => {
      window.__failingModes = [];
      window.__gumDelay = 0;
      window.__streams = [];
      MediaDevices.prototype.getUserMedia = (constraints) => new Promise((resolve, reject) => {
        const mode = constraints.video.facingMode;
        setTimeout(() => {
          if (window.__failingModes.includes(mode)) {
            const err = new Error(`${mode} camera unavailable`);
            err.name = 'NotReadableError';
            reject(err);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 48;
          const ctx = canvas.getContext('2d');
          setInterval(() => ctx.fillRect(0, 0, 64, 48), 50);
          const stream = canvas.captureStream(10);
          window.__streams.push({ mode, stream });
          resolve(stream);
        }, window.__gumDelay);
      });
      MediaDevices.prototype.enumerateDevices = async () => [
        { kind: 'videoinput', deviceId: 'front', label: 'Front' },
        { kind: 'videoinput', deviceId: 'back', label: 'Back' }
      ];
    });
    await page.goto('/');
    await page.locator('#step2 .step-header').click();
    await page.locator('#takePhotoBtn').click();
    await expect(page.locator('#cameraSwitchBtn')).toBeVisible();
  });

  const streams = page => page.evaluate(() => window.__streams.map(s => ({
    mode: s.mode,
    state: s.stream.getVideoTracks()[0].readyState,
    attached: document.getElementById('cameraVideo').srcObject === s.stream
  })));

  test('switches to the other camera and releases the old one', async ({ page }) => {
    await page.locator('#cameraSwitchBtn').click();
    await expect.poll(() => page.evaluate(() => window.cameraState.facingMode)).toBe('user');

    expect(await streams(page)).toEqual([
      { mode: 'environment', state: 'ended', attached: false },
      { mode: 'user', state: 'live', attached: true }
    ]);
    await expect(page.locator('#cameraError')).toBeHidden();
  });

  test('falls back to the previous camera when the switch fails', async ({ page }) => {
    await page.evaluate(() => { window.__failingModes = ['user']; });
    await page.locator('#cameraSwitchBtn').click();

    await expect.poll(async () => (await streams(page)).length).toBe(2);
    expect(await page.evaluate(() => window.cameraState.facingMode)).toBe('environment');
    expect(await streams(page)).toEqual([
      { mode: 'environment', state: 'ended', attached: false },
      { mode: 'environment', state: 'live', attached: true }
    ]);
    // Preview stays usable; the switch that doesn't work is hidden
    await expect(page.locator('#cameraError')).toBeHidden();
    await expect(page.locator('#cameraSwitchBtn')).toBeHidden();
  });

  test('shows an error if neither camera can be opened', async ({ page }) => {
    await page.evaluate(() => { window.__failingModes = ['user', 'environment']; });
    await page.locator('#cameraSwitchBtn').click();

    await expect(page.locator('#cameraError')).toBeVisible();
    await expect(page.locator('#cameraErrorMessage')).toContainText('Failed to switch camera');
    expect(await page.evaluate(() => window.cameraState.facingMode)).toBe('environment');
    expect(await page.evaluate(() => window.cameraState.stream)).toBeNull();
  });

  test('releases the new stream if the camera is closed mid-switch', async ({ page }) => {
    await page.evaluate(() => { window.__gumDelay = 600; });
    await page.locator('#cameraSwitchBtn').click();
    await page.locator('.camera-modal-close').click();

    await expect.poll(async () => (await streams(page)).length).toBe(2);
    expect((await streams(page)).map(s => s.state)).toEqual(['ended', 'ended']);
    expect(await page.evaluate(() => window.cameraState.stream)).toBeNull();
  });
});

test.describe('Processing captured photos', () => {
  test('captures are encoded once, at 1600px, and Done adds them unchanged', async ({ page }) => {
    // A camera larger than the 1600px limit
    await page.addInitScript(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 2400;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');
      let hue = 0;
      setInterval(() => {
        ctx.fillStyle = `hsl(${hue = (hue + 10) % 360}, 60%, 50%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }, 50);
      MediaDevices.prototype.getUserMedia = async () => canvas.captureStream(20);
      MediaDevices.prototype.enumerateDevices = async () => [
        { kind: 'videoinput', label: 'Back Camera', deviceId: 'back' }
      ];
    });
    await page.goto('/');

    await openCameraReady(page);
    await page.evaluate(() => {
      window.__encodeCount = 0;
      const original = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        window.__encodeCount++;
        return original.apply(this, args);
      };
    });

    await capture(page, 1);
    await capture(page, 2);
    const captured = await page.evaluate(() => [...window.cameraState.capturedPhotos]);

    // Already a JPEG at its final size when captured
    expect(captured.every(d => d.startsWith('data:image/jpeg;base64,'))).toBe(true);
    const size = await page.evaluate(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
      img.src = src;
    }), captured[0]);
    expect(size).toEqual([1600, 900]);

    await page.locator('#cameraDoneBtn').click();
    await expect(page.locator('#cameraModal')).toBeHidden();

    // Done adds the same data without re-encoding
    expect(await page.evaluate(() => window.uploadedImages)).toEqual(captured);
    expect(await page.evaluate(() => window.__encodeCount)).toBe(2);
    await expect(page.locator('.preview-item')).toHaveCount(2);
  });
});
