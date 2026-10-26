// E2E TESTS: here go the tests that use the real client and server in a browser.
// This is the smoke test: it checks that the whole setup works. Keep it.
import { expect, test } from '@playwright/test';

test('the app opens in the browser', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Mountain Hut');
  await expect(page.getByRole('heading', { name: 'Mountain Hut' })).toBeVisible();
});
