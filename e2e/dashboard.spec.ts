import { test, expect } from '@playwright/test';

// Without a session every dashboard entry point lands on the staff sign-in,
// and the sign-in page offers no registration (ebneely/bobr-dashboard#35, #36).

test('the dashboard root sends a signed-out visitor to sign-in', async ({ page }) => {
  await page.goto('/pl');
  await expect(page).toHaveURL(/\/pl\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: /zarejestruj/i })).toHaveCount(0);
});

test('a deep link survives the trip through sign-in', async ({ page }) => {
  await page.goto('/pl/dashboard/orders');
  await expect(page).toHaveURL(/\/pl\/login\?redirect=%2Fpl%2Fdashboard%2Forders$/);
});
