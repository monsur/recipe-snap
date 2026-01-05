const { test, expect } = require('@playwright/test');

test.describe('Step 1: Setup - API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipe-snap.html');
    // Clear localStorage before each test
    await page.evaluate(() => localStorage.clear());
  });

  test('should load the page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Recipe Snap/);
    await expect(page.locator('h1')).toHaveText('Recipe Snap');
  });

  test('should have all three steps visible', async ({ page }) => {
    await expect(page.locator('#step1')).toBeVisible();
    await expect(page.locator('#step2')).toBeVisible();
    await expect(page.locator('#step3')).toBeVisible();
  });

  test('should show API key input field', async ({ page }) => {
    const apiKeyInput = page.locator('#apiKey');
    await expect(apiKeyInput).toBeVisible();
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('should store API key in localStorage when saved', async ({ page }) => {
    const testApiKey = 'test-api-key-12345';

    // Enter API key
    await page.locator('#apiKey').fill(testApiKey);

    // Click save button
    await page.locator('#step1 .btn-primary').click();

    // Verify it's stored in localStorage
    const storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    expect(storedKey).toBe(testApiKey);
  });

  test('should load API key from localStorage on page load', async ({ page }) => {
    const testApiKey = 'persisted-api-key-67890';

    // Set API key in localStorage
    await page.evaluate((key) => localStorage.setItem('geminiApiKey', key), testApiKey);

    // Reload page
    await page.reload();

    // Verify input is populated
    const apiKeyValue = await page.locator('#apiKey').inputValue();
    expect(apiKeyValue).toBe(testApiKey);
  });

  test('should toggle advanced options', async ({ page }) => {
    const advancedOptions = page.locator('#advancedOptions');

    // Initially closed
    await expect(advancedOptions).not.toHaveClass(/open/);

    // Click to open
    await page.locator('.advanced-toggle').click();
    await expect(advancedOptions).toHaveClass(/open/);

    // Click to close
    await page.locator('.advanced-toggle').click();
    await expect(advancedOptions).not.toHaveClass(/open/);
  });

  test('should have default model value', async ({ page }) => {
    await page.locator('.advanced-toggle').click();
    const modelInput = page.locator('#model');
    await expect(modelInput).toHaveValue('gemini-1.5-flash');
  });

  test('should store custom model in localStorage', async ({ page }) => {
    const customModel = 'gemini-pro';

    await page.locator('.advanced-toggle').click();
    await page.locator('#model').fill(customModel);
    await page.locator('#step1 .btn-primary').click();

    const storedModel = await page.evaluate(() => localStorage.getItem('model'));
    expect(storedModel).toBe(customModel);
  });

  test('should store custom prompt in localStorage', async ({ page }) => {
    const customPrompt = 'Extract recipe with special instructions';

    await page.locator('.advanced-toggle').click();
    await page.locator('#prompt').fill(customPrompt);
    await page.locator('#step1 .btn-primary').click();

    const storedPrompt = await page.evaluate(() => localStorage.getItem('prompt'));
    expect(storedPrompt).toBe(customPrompt);
  });

  test('should save all values (API key, model, and prompt) together in localStorage', async ({ page }) => {
    const testApiKey = 'test-api-key-comprehensive';
    const testModel = 'gemini-2.0-flash';
    const testPrompt = 'Custom comprehensive prompt for testing';

    // Fill all fields
    await page.locator('#apiKey').fill(testApiKey);
    await page.locator('.advanced-toggle').click();
    await page.locator('#model').fill(testModel);
    await page.locator('#prompt').fill(testPrompt);

    // Click save button
    await page.locator('#step1 .btn-primary').click();

    // Verify all values are stored in localStorage
    const storedApiKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    const storedModel = await page.evaluate(() => localStorage.getItem('model'));
    const storedPrompt = await page.evaluate(() => localStorage.getItem('prompt'));

    expect(storedApiKey).toBe(testApiKey);
    expect(storedModel).toBe(testModel);
    expect(storedPrompt).toBe(testPrompt);
  });

  test('should clear all data when clear data link is clicked', async ({ page }) => {
    // Set some data
    await page.locator('#apiKey').fill('test-key');
    await page.locator('#step1 .btn-primary').click();

    // Verify data is stored
    let storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    expect(storedKey).toBe('test-key');

    // Mock the confirm dialog to return true
    page.on('dialog', dialog => dialog.accept());

    // Click clear data
    await page.locator('.advanced-toggle').click();
    await page.locator('.clear-data-link').click();

    // Verify localStorage is cleared
    storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    expect(storedKey).toBeNull();

    // Verify input is cleared
    await expect(page.locator('#apiKey')).toHaveValue('');
  });

  test('should collapse and expand steps', async ({ page }) => {
    const step1 = page.locator('#step1');

    // Initially expanded
    await expect(step1).not.toHaveClass(/collapsed/);

    // Click header to collapse
    await page.locator('#step1 .step-header').click();
    await expect(step1).toHaveClass(/collapsed/);

    // Click header to expand
    await page.locator('#step1 .step-header').click();
    await expect(step1).not.toHaveClass(/collapsed/);
  });
});
