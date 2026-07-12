import { test, expect, type Page } from '@playwright/test';
import {
  INP_BUDGET_MS,
  CAPTURE_PLACEHOLDER,
  measureInteractionLatencyMs,
  becomesVisible,
} from './support/measure';

/**
 * SPEC-UX-PHYSICS D7.3 / D7.4: interaction traces + INP budget on the three
 * headline flows (capture submit, object open, approve). Each spec drives the
 * REAL product surface (no mock routes) and asserts the interaction stays
 * within the 200ms INP budget. The final spec proves the gate bites: a
 * synthetic 250ms handler regression is caught, so a real 250ms regression in
 * any of the flow handlers above would fail CI.
 */

async function gotoCommonplace(page: Page): Promise<void> {
  await page.goto('/commonplace');
  await expect(page.getByPlaceholder(CAPTURE_PLACEHOLDER)).toBeVisible({ timeout: 30_000 });
}

test.describe('UX-D7 latency budget (INP 200ms) on the headline flows', () => {
  test('capture submit stays within the 200ms INP budget', async ({ page }) => {
    await gotoCommonplace(page);
    const input = page.getByPlaceholder(CAPTURE_PLACEHOLDER);
    const stamp = Date.now();
    const probe = `${stamp} e2e capture probe`;
    await input.click();
    await input.fill(probe);

    const latency = await measureInteractionLatencyMs(page, async () => {
      await input.press('Enter');
    });

    // Optimistic/local-first capture: the recent-captures row appears without a
    // server round-trip. That optimistic row is the real success signal.
    await expect(page.getByText(new RegExp(String(stamp))).first()).toBeVisible();
    test.info().annotations.push({ type: 'inp-capture-ms', description: String(latency) });
    expect(
      latency,
      `capture submit INP ${latency}ms exceeds ${INP_BUDGET_MS}ms budget`,
    ).toBeLessThanOrEqual(INP_BUDGET_MS);
  });

  test('object open stays within the 200ms INP budget', async ({ page }) => {
    await gotoCommonplace(page);
    // Real object-open affordance: the daily queue "Open" button. Skip honestly
    // when the environment has no object to open (no fabricated data).
    const openButton = page.getByRole('button', { name: /^Open( to file manually)?$/ }).first();
    const appeared = await becomesVisible(openButton, 15_000);
    test.skip(!appeared, 'No object with an Open affordance in this environment');

    const latency = await measureInteractionLatencyMs(page, async () => {
      await openButton.click();
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    test.info().annotations.push({ type: 'inp-object-open-ms', description: String(latency) });
    expect(
      latency,
      `object open INP ${latency}ms exceeds ${INP_BUDGET_MS}ms budget`,
    ).toBeLessThanOrEqual(INP_BUDGET_MS);
  });

  test('approve stays within the 200ms INP budget', async ({ page }) => {
    await page.goto('/v2/workrooms');
    const approvalsTab = page.getByRole('button', { name: /Approvals/ }).first();
    const tabVisible = await becomesVisible(approvalsTab, 30_000);
    test.skip(!tabVisible, 'Workroom control center unavailable in this environment');
    await approvalsTab.click();

    const approveButton = page.getByRole('button', { name: 'approve once' }).first();
    const hasApproval = await becomesVisible(approveButton, 15_000);
    test.skip(!hasApproval, 'No pending approval to act on in this environment');

    const latency = await measureInteractionLatencyMs(page, async () => {
      await approveButton.click();
    });
    test.info().annotations.push({ type: 'inp-approve-ms', description: String(latency) });
    expect(
      latency,
      `approve INP ${latency}ms exceeds ${INP_BUDGET_MS}ms budget`,
    ).toBeLessThanOrEqual(INP_BUDGET_MS);
  });

  test('budget gate detects a synthetic 250ms handler regression', async ({ page }) => {
    await gotoCommonplace(page);
    // Attach a real click handler that blocks the main thread for 250ms to a
    // real, visible control, then measure. This proves the 200ms INP gate above
    // actually bites: a 250ms handler regression is caught. Test-only; the
    // handler is added in the test and never shipped.
    const target = page.getByPlaceholder(CAPTURE_PLACEHOLDER);
    await target.evaluate((el) => {
      el.addEventListener('pointerdown', () => {
        const end = performance.now() + 250;
        // Busy-wait blocks one interaction for 250ms, mirroring a slow handler.
        while (performance.now() < end) {
          /* block */
        }
      });
    });

    const latency = await measureInteractionLatencyMs(page, async () => {
      await target.click();
    });
    test.info().annotations.push({ type: 'inp-synthetic-ms', description: String(latency) });
    expect(
      latency,
      `synthetic 250ms handler (${latency}ms) was not caught by the INP budget gate`,
    ).toBeGreaterThan(INP_BUDGET_MS);
  });
});
