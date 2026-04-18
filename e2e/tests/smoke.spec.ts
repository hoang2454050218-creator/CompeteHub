import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('home page loads with hero', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/CompeteHub/i);
  });

  test('competitions list renders', async ({ page }) => {
    await page.goto('/competitions');
    await expect(page.locator('body')).toContainText(/Cu.+c thi/i);
  });

  test('login page renders email + password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page renders all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(2);
  });

  test('dark mode preference persists across reloads', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    const html = await page.locator('html').getAttribute('class');
    expect(html).toContain('dark');
    await context.clearCookies();
  });
});

test.describe('Public surface', () => {
  test('terms / privacy / cookie pages are reachable', async ({ page }) => {
    for (const path of ['/terms', '/privacy', '/cookies']) {
      const res = await page.goto(path);
      expect(res?.ok(), `path ${path} should return 200`).toBeTruthy();
    }
  });

  test('cookie consent banner appears on fresh visit', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cookieConsent'));
    await page.reload();
    await expect(page.getByRole('dialog', { name: /cookie/i })).toBeVisible();
  });
});

test.describe('Auth gating', () => {
  test('unauthenticated /settings redirects to login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated /admin redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Backend health (HTTP)', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/v1/auth/oauth-providers returns provider flags', async ({ request }) => {
    const res = await request.get('/api/v1/auth/oauth-providers');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('google');
    expect(body.data).toHaveProperty('github');
  });
});
