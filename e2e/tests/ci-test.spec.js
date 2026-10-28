// CI test: this test fails on purpose. Do not merge.
import { expect, test } from '@playwright/test';

test('fails on purpose', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('This title does not exist');
});
