import { test, expect } from '@playwright/test';

test.describe('Corkboard App Smoke Test', () => {
  test('loads home page and displays the pegboard canvas and welcome sign-in card', async ({ page }) => {
    await page.goto('/');

    // Verify title exists
    await expect(page).toHaveTitle(/onethreenine|corkboard|bulletin/i);

    // Verify that the welcome / sign-in card is visible
    const welcomeHeading = page.getByRole('heading', { name: 'Welcome' });
    await expect(welcomeHeading).toBeVisible({ timeout: 10000 });

    const signInPrompt = page.getByText('Sign in to add to the board');
    await expect(signInPrompt).toBeVisible();
  });
});
