const { expect } = require('@playwright/test');

/**
 * Expands a step (step1/step2/step3) if it is collapsed, so its buttons are
 * visible and clickable.
 */
async function expandStep(page, stepId) {
  const step = page.locator(`#${stepId}`);
  if (await step.evaluate(el => el.classList.contains('collapsed'))) {
    await page.locator(`#${stepId} .step-header`).click();
  }
  await expect(step).not.toHaveClass(/collapsed/);
}

/**
 * Replaces navigator.clipboard with an in-page stub. Real clipboard access
 * needs permissions that only Chromium lets Playwright grant. Whatever the
 * app writes is available via readStubClipboard().
 */
async function stubClipboard(page) {
  await page.evaluate(() => {
    window.__clipboardText = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => { window.__clipboardText = text; },
        readText: async () => window.__clipboardText
      }
    });
  });
}

function readStubClipboard(page) {
  return page.evaluate(() => window.__clipboardText);
}

/**
 * Collects the text of every alert/confirm dialog, accepting each one.
 */
function collectDialogs(page) {
  const messages = [];
  page.on('dialog', async dialog => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  return messages;
}

/**
 * Shrinks the app's retry delays so tests that exercise retries run fast.
 */
async function fastRetries(page) {
  await page.evaluate(() => { CONFIG.retry.baseDelayMs = 1; });
}

module.exports = { expandStep, stubClipboard, readStubClipboard, collectDialogs, fastRetries };
