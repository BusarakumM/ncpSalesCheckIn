import { Page, Route } from '@playwright/test';

export async function loginAs(page: Page, role: 'SUPERVISOR' | 'EMPLOYEE' = 'EMPLOYEE') {
  await page.context().addCookies([
    { name: 'session', value: 'dev-session', domain: 'localhost', path: '/' },
    { name: 'role', value: role, domain: 'localhost', path: '/' },
    // Nice to have for headers showing name/email
    { name: 'name', value: role === 'SUPERVISOR' ? 'Supervisor' : 'Sales Support', domain: 'localhost', path: '/' },
    { name: 'email', value: role === 'SUPERVISOR' ? 'supervisor@example.com' : 'sales@example.com', domain: 'localhost', path: '/' },
    { name: 'username', value: role === 'SUPERVISOR' ? 'supervisor@example.com' : 'sales@example.com', domain: 'localhost', path: '/' },
  ]);
}

// Generic catch‑all JSON OK response
function ok(body: any = { ok: true }, status = 200) {
  return {
    status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function stubCommonApis(page: Page) {
  // Specific endpoints first
  await page.route('**/api/pa/activity', (route: Route) => {
    return route.fulfill(
      ok({
        ok: true,
        rows: [
          { date: '2025-01-01', location: 'HQ', status: 'completed', checkin: '09:00', checkout: '18:00' },
          { date: '2025-01-01', location: 'Branch', status: 'incomplete', checkin: '10:15' },
        ],
      })
    );
  });

  await page.route('**/api/pa/report', (route: Route) => {
    return route.fulfill(
      ok({
        ok: true,
        rows: [
          {
            date: '2025-01-01',
            checkin: '09:00',
            checkout: '18:00',
            location: 'HQ',
            detail: 'Daily visit',
            name: 'Alice',
            district: 'North',
            checkinGps: '13.7563,100.5018',
            checkoutGps: '13.7564,100.5019',
            distanceKm: 0.02,
            status: 'completed',
          },
        ],
      })
    );
  });

  await page.route('**/api/pa/report/summary', (route: Route) => {
    return route.fulfill(
      ok({
        ok: true,
        summary: [
          { name: 'Alice', district: 'North', total: 3, completed: 2, incomplete: 0, ongoing: 1 },
          { name: 'Bob', district: 'South', total: 2, completed: 1, incomplete: 1, ongoing: 0 },
        ],
      })
    );
  });

  await page.route('**/api/pa/time-attendance', (route: Route) => {
    return route.fulfill(
      ok({
        ok: true,
        rows: [
          {
            date: '2025-01-01',
            checkin: '09:00',
            checkout: '18:00',
            name: 'Alice',
            district: 'North',
            checkinGps: '13.7563,100.5018',
            checkoutGps: '13.7564,100.5019',
            distanceKm: 0.02,
          },
        ],
      })
    );
  });

  // Fallback for any other API calls we didn't cover
  await page.route('**/api/**', (route: Route) => route.fulfill(ok()));

  // Optional: prevent external map image fetches from slowing tests
  await page.route('https://maps.googleapis.com/**', (route: Route) => {
    return route.fulfill({ status: 204, body: '' });
  });
}
