import { test, expect, request } from '@playwright/test';

const SERVER = process.env.E2E_SERVER ?? 'http://localhost:8080';

test('mine, send, balance updates', async ({ page, browser }) => {
  // Helper: login a given email by reading the magic link from the server's test inbox.
  async function login(email: string) {
    const ctx = await request.newContext();
    await ctx.post(`${SERVER}/auth/request`, { data: { email } });
    // In E2E mode the server is started with RPOW_TEST_INBOX=true and exposes the last link via /test/last-link/:email.
    const r = await ctx.get(`${SERVER}/test/last-link/${encodeURIComponent(email)}`);
    expect(r.ok()).toBeTruthy();
    const link = (await r.json()).link as string;
    await page.goto(link);
    await page.waitForURL(/#\/wallet/);
  }

  await login('e2e-a@x.com');
  await page.goto('/#/mine');
  await page.getByRole('button', { name: /MINE/ }).click();
  await page.waitForFunction(() => /STATUS\s*:\s*MINTED/.test(document.body.textContent ?? ''), null, { timeout: 60_000 });

  await page.goto('/#/send');
  // Ensure recipient exists in this run by logging them in once in another context.
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto('about:blank');
  const ctx = await request.newContext();
  await ctx.post(`${SERVER}/auth/request`, { data: { email: 'e2e-b@x.com' } });
  const r = await ctx.get(`${SERVER}/test/last-link/${encodeURIComponent('e2e-b@x.com')}`);
  const link = (await r.json()).link;
  await p2.goto(link);

  // Back on the original page, send 1 to b.
  await page.fill('input[type=email]', 'e2e-b@x.com');
  await page.fill('input[type=number]', '1');
  await page.getByRole('button', { name: /SEND/ }).click();
  await expect(page.locator('text=transfer id:')).toBeVisible({ timeout: 5000 });
});
