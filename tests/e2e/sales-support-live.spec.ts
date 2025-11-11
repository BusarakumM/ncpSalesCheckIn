import { test, expect } from '@playwright/test';
import { loginAs } from './utils';

// Enable real-backend E2E with: E2E_LIVE=1 npm run test:e2e
const LIVE = process.env.E2E_LIVE === '1';

// Known point-of-interest in Bangkok for stable geolocation + place search
const BKK_POI = {
  name: 'CentralWorld',
  latitude: 13.746, // near CentralWorld
  longitude: 100.539,
};

test.describe('Sales Support live E2E (real APIs)', () => {
  test.skip(!LIVE, 'Set E2E_LIVE=1 to run live E2E tests');

  test.beforeEach(async ({ page, context }) => {
    await loginAs(page, 'EMPLOYEE');
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: BKK_POI.latitude, longitude: BKK_POI.longitude });
  });

  test('Check-in and Check-out completes and appears in list', async ({ page }) => {
    // Go to New Task
    await page.goto('/checkin/new');

    // Fill location (validation runs on blur/submit and uses geolocation + Google Places)
    await page.getByPlaceholder('Enter or pick a place').fill(BKK_POI.name);

    // Attach a small check-in photo (1x1 PNG)
    const onePx = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'checkin.png', mimeType: 'image/png', buffer: onePx });

    // Submit Check-in; then always go to list and open the new task after it appears.
    page.once('dialog', async d => { await d.accept(); });
    await page.getByRole('button', { name: 'Submit Check-in' }).click();
    await page.waitForTimeout(1000);
    await page.goto('/checkin');
    await expect.poll(async () => (await page.getByText(/CentralWorld|Central World/i).count()) > 0, { timeout: 60_000 }).toBeTruthy();
    const card = page.locator('text=/CentralWorld|Central World/i').first();
    await card.locator('xpath=..').getByRole('link', { name: /^CHECK$/ }).click({ trial: false }).catch(async () => {
      await page.getByRole('link', { name: /^CHECK$/ }).first().click();
    });
    await expect(page.getByRole('button', { name: 'Check-out' })).toBeVisible({ timeout: 60_000 });

    // Start checkout; checkout time appears and GPS loads
    await page.getByRole('button', { name: 'Check-out' }).click();
    await expect(page.getByText('Checkout GPS')).toBeVisible();
    await expect.poll(async () => (await page.getByText('Checkout GPS').locator('..').textContent()) || '').toContain(',');

    // Attach a checkout photo and submit
    await page.locator('input[type="file"]').nth(1).setInputFiles({ name: 'checkout.png', mimeType: 'image/png', buffer: onePx });
    await page.getByRole('button', { name: 'Submit Checkout' }).click();

    // Back to list and verify our location appears (allow eventual consistency)
    await page.goto('/checkin');
    await expect.poll(async () => (await page.getByText(/CentralWorld|Central World/i).count()) > 0, { timeout: 60_000 }).toBeTruthy();
  });

  test('Submit full-day leave and verify in history', async ({ page }) => {
    // Open Leave page and wait for UI
    await page.goto('/leave');
    await expect(page.getByRole('heading', { name: /^Leave$/ })).toBeVisible();

    // Ensure Full Day mode selected and fill date tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByRole('button', { name: 'Full Day' }).click();
    await page.locator('input[type="date"]').first().fill(tomorrow);

    // Choose leave type and reason
    await page.getByText('เลือกประเภทการลา').click();
    await page.getByRole('option', { name: 'ลากิจ' }).click();
    await page.locator('input[type="text"]').first().fill('E2E live test');

    // Save row, then Submit all
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('No items yet')).toBeHidden().catch(() => {});

    // Handle alert dialog on submit
    let submittedMsg = '';
    page.once('dialog', async (d) => { submittedMsg = d.message(); await d.accept(); });
    await page.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(1000);

    // Poll the backend API directly to confirm persistence (Graph can be eventually consistent)
    await expect.poll(async () => {
      const data = await page.evaluate(async () => {
        const r = await fetch(`/api/pa/leave?me=1`);
        if (!r.ok) return null;
        return r.json();
      });
      if (!data || !data.ok) return false;
      const rows = Array.isArray(data.rows) ? data.rows : [];
      return rows.some((r: any) => String(r?.reason || '').includes('E2E live test'));
    }, { timeout: 90_000, intervals: [1000, 2000, 5000] }).toBeTruthy();

    // Verify appears in My Leave History
    await page.goto('/leave/history');
    await page.getByRole('button', { name: 'Search' }).click();
    // Either the type or reason should be visible; allow extra time
    await expect.poll(async () => (await page.getByText('E2E live test').count()) > 0 || (await page.getByText('ลากิจ').count()) > 0, { timeout: 60_000 }).toBeTruthy();
  });
});
