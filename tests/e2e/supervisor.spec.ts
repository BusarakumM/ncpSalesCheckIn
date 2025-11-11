import { test, expect } from '@playwright/test';
import { loginAs, stubCommonApis } from './utils';

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'SUPERVISOR');
  await stubCommonApis(page);
});

test('root redirects to /supervisor and tiles render', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/supervisor$/);
  await expect(page.getByRole('link', { name: /Sales Supports\s*Summary/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Calendar/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Report/i })).toBeVisible();
});

test('summary page loads and shows mocked summary rows', async ({ page }) => {
  await page.goto('/report/summary');
  await expect(page.getByRole('heading', { name: /Sales Supports Summary/i })).toBeVisible();
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Bob')).toBeVisible();
});

test('time-attendance page loads with mocked data', async ({ page }) => {
  await page.goto('/time-attendance');
  await expect(page.getByRole('heading', { name: /Time Attendance report/i })).toBeVisible();
  await expect(page.getByText('Alice')).toBeVisible();
});

