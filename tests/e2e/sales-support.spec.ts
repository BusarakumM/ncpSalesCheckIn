import { test, expect } from '@playwright/test';
import { loginAs, stubCommonApis } from './utils';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'EMPLOYEE');
  await stubCommonApis(page);
});

test('root redirects to /home and tiles render', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('link', { name: /Check-in\s*Check-out/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Leave/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Report/i })).toBeVisible();
});

test('check-in page shows mocked rows and navigates to detail', async ({ page }) => {
  await page.goto('/checkin');
  await expect(page.getByRole('heading', { name: /Check-in\s*Check-out/i })).toBeVisible();
  await expect(page.getByText('HQ')).toBeVisible();
  const checkBtn = page.getByRole('link', { name: /^CHECK$/ });
  await expect(checkBtn.first()).toBeVisible();
  await checkBtn.first().click();
  await expect(page).toHaveURL(/\/checkin\//);
});

test('report page loads and displays mocked data', async ({ page }) => {
  await page.goto('/report');
  await expect(page.getByRole('heading', { name: /^Report$/ })).toBeVisible();
  await expect(page.getByText('HQ')).toBeVisible();
});

