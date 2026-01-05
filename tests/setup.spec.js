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

  test('should store API key, model, and prompt in localStorage when saved', async ({ page }) => {
    const testApiKey = 'test-api-key-12345';
    const testModel = 'gemini-2.0-flash-test';
    const testPrompt = 'Test prompt for verification';

    // Enter API key
    await page.locator('#apiKey').fill(testApiKey);

    // Open advanced options and fill model and prompt
    await page.locator('.advanced-toggle').click();
    await page.locator('#model').fill(testModel);
    await page.locator('#prompt').fill(testPrompt);

    // Click save button
    await page.locator('#step1 .btn-primary').click();

    // Verify all values are stored in localStorage
    const storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    const storedModel = await page.evaluate(() => localStorage.getItem('model'));
    const storedPrompt = await page.evaluate(() => localStorage.getItem('prompt'));

    expect(storedKey).toBe(testApiKey);
    expect(storedModel).toBe(testModel);
    expect(storedPrompt).toBe(testPrompt);
  });

  test('should load API key, model, and prompt from localStorage on page load', async ({ page }) => {
    const testApiKey = 'persisted-api-key-67890';
    const testModel = 'gemini-pro-persisted';
    const testPrompt = 'Persisted custom prompt for testing';

    // Set all values in localStorage
    await page.evaluate((values) => {
      localStorage.setItem('geminiApiKey', values.apiKey);
      localStorage.setItem('model', values.model);
      localStorage.setItem('prompt', values.prompt);
    }, { apiKey: testApiKey, model: testModel, prompt: testPrompt });

    // Reload page
    await page.reload();

    // When API key is saved, step 1 will be collapsed, so we need to expand it first
    await page.locator('#step1 .step-header').click();

    // Verify API key input is populated
    const apiKeyValue = await page.locator('#apiKey').inputValue();
    expect(apiKeyValue).toBe(testApiKey);

    // Verify model input is populated (need to open advanced options first)
    await page.locator('.advanced-toggle').click();
    const modelValue = await page.locator('#model').inputValue();
    expect(modelValue).toBe(testModel);

    // Verify prompt input is populated
    const promptValue = await page.locator('#prompt').inputValue();
    expect(promptValue).toBe(testPrompt);
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

  test('should clear all data when clear data link is clicked', async ({ page }) => {
    // Set all data
    await page.locator('#apiKey').fill('test-key');
    await page.locator('.advanced-toggle').click();
    await page.locator('#model').fill('custom-model');
    await page.locator('#prompt').fill('custom prompt text');
    await page.locator('#step1 .btn-primary').click();

    // Verify all data is stored
    let storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    let storedModel = await page.evaluate(() => localStorage.getItem('model'));
    let storedPrompt = await page.evaluate(() => localStorage.getItem('prompt'));
    expect(storedKey).toBe('test-key');
    expect(storedModel).toBe('custom-model');
    expect(storedPrompt).toBe('custom prompt text');

    // Mock the confirm dialog to return true
    page.on('dialog', dialog => dialog.accept());

    // Click clear data (advanced options should already be open)
    await page.locator('.clear-data-link').click();

    // Verify localStorage is cleared
    storedKey = await page.evaluate(() => localStorage.getItem('geminiApiKey'));
    storedModel = await page.evaluate(() => localStorage.getItem('model'));
    storedPrompt = await page.evaluate(() => localStorage.getItem('prompt'));
    expect(storedKey).toBeNull();
    expect(storedModel).toBeNull();
    expect(storedPrompt).toBeNull();

    // Verify all inputs are reset to defaults
    await expect(page.locator('#apiKey')).toHaveValue('');
    await expect(page.locator('#model')).toHaveValue('gemini-1.5-flash');
    await expect(page.locator('#prompt')).toHaveValue(await page.evaluate(() => {
      return `You are a recipe extraction expert. Analyze the provided recipe image(s) and extract the following information in JSON format:

{
  "name": "Recipe name",
  "ingredients": "Complete list of ingredients, one per line",
  "directions": ["Step 1", "Step 2", ...],
  "servings": "Number of servings",
  "prep_time": "Preparation time",
  "cook_time": "Cooking time"
}

Extract ALL ingredients with exact quantities. Return ONLY valid JSON.`;
    }));
  });

  test('should collapse and expand steps when clicked', async ({ page }) => {
    const step1 = page.locator('#step1');

    // Without API key, step 1 is initially expanded
    await expect(step1).not.toHaveClass(/collapsed/);

    // Click header to collapse
    await page.locator('#step1 .step-header').click();
    await expect(step1).toHaveClass(/collapsed/);

    // Click header to expand
    await page.locator('#step1 .step-header').click();
    await expect(step1).not.toHaveClass(/collapsed/);
  });

  test('should expand step 1 and collapse steps 2 and 3 when no API key is saved', async ({ page }) => {
    // No API key in localStorage (already cleared in beforeEach)

    // Reload to trigger initialization
    await page.reload();

    // Step 1 should be expanded
    const step1 = page.locator('#step1');
    await expect(step1).not.toHaveClass(/collapsed/);

    // Steps 2 and 3 should be collapsed
    const step2 = page.locator('#step2');
    const step3 = page.locator('#step3');
    await expect(step2).toHaveClass(/collapsed/);
    await expect(step3).toHaveClass(/collapsed/);
  });

  test('should expand step 2 and collapse steps 1 and 3 when API key is saved', async ({ page }) => {
    // Set API key in localStorage
    await page.evaluate(() => localStorage.setItem('geminiApiKey', 'test-api-key'));

    // Reload to trigger initialization
    await page.reload();

    // Step 2 should be expanded
    const step2 = page.locator('#step2');
    await expect(step2).not.toHaveClass(/collapsed/);

    // Steps 1 and 3 should be collapsed
    const step1 = page.locator('#step1');
    const step3 = page.locator('#step3');
    await expect(step1).toHaveClass(/collapsed/);
    await expect(step3).toHaveClass(/collapsed/);
  });
});
