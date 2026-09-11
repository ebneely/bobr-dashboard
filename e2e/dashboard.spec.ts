import { test, expect } from '@playwright/test';

test('the dashboard root redirects to the dashboard', async ({ page }) => {
  await page.goto('/pl');
  await expect(page).toHaveURL(/\/pl\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
