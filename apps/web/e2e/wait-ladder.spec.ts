import { test, expect } from '@playwright/test';
import {
  FIRST_FEEDBACK_TIER_MS,
  THINKING_SPINNER,
  CAPTURE_PLACEHOLDER,
  becomesVisible,
} from './support/measure';

/**
 * HANDOFF-WAIT-LADDER WL-5: extend the D7 trace job with the wait-ladder rule.
 * No indeterminate spinner may remain visible beyond 10s (a T3 job card is
 * expected instead), and the headline flows record time-to-first-feedback
 * within the tier rules. The final spec proves the 10s rule bites: a synthetic
 * 12s spinner is still visible at the 10s mark, so it would fail CI.
 */

test.describe('WL-5 wait ladder: no indeterminate spinner beyond 10s', () => {
  test('capture submit gives prompt first feedback and no spinner past 10s', async ({ page }) => {
    await page.goto('/commonplace');
    const input = page.getByPlaceholder(CAPTURE_PLACEHOLDER);
    await expect(input).toBeVisible({ timeout: 30_000 });
    const stamp = Date.now();
    await input.click();
    await input.fill(`${stamp} e2e wait-ladder probe`);

    const started = Date.now();
    await input.press('Enter');
    // First feedback is the optimistic recent-captures row (T0/T1, no spinner).
    await expect(page.getByText(new RegExp(String(stamp))).first()).toBeVisible();
    const ttff = Date.now() - started;
    test.info().annotations.push({ type: 'ttff-capture-ms', description: String(ttff) });
    expect(
      ttff,
      `capture first feedback ${ttff}ms is outside the wait-tier rules`,
    ).toBeLessThan(FIRST_FEEDBACK_TIER_MS);

    // WL-5: no indeterminate spinner may persist beyond 10s.
    await expect(
      page.getByRole(THINKING_SPINNER.role, { name: THINKING_SPINNER.name }),
    ).toBeHidden({ timeout: 10_000 });
  });

  test('object open leaves no indeterminate spinner past 10s', async ({ page }) => {
    await page.goto('/commonplace');
    await expect(page.getByPlaceholder(CAPTURE_PLACEHOLDER)).toBeVisible({ timeout: 30_000 });
    const openButton = page.getByRole('button', { name: /^Open( to file manually)?$/ }).first();
    const appeared = await becomesVisible(openButton, 15_000);
    test.skip(!appeared, 'No object with an Open affordance in this environment');

    await openButton.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // The drawer's own loading state is text ("Loading..."), never a persistent
    // indeterminate spinner: none may remain past 10s.
    await expect(
      page.getByRole(THINKING_SPINNER.role, { name: THINKING_SPINNER.name }),
    ).toBeHidden({ timeout: 10_000 });
  });

  test('wait-ladder gate detects a synthetic 12s spinner regression', async ({ page }) => {
    await page.goto('/commonplace');
    await expect(page.getByPlaceholder(CAPTURE_PLACEHOLDER)).toBeVisible({ timeout: 30_000 });
    // Inject a real indeterminate spinner (role=status, "Thinking") that stays
    // for 12s, mirroring a regression where a T3 job never converts to a job
    // card. This proves the 10s rule above bites. Test-only injection.
    await page.evaluate(() => {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-label', 'Thinking');
      el.id = 'cp-e2e-synthetic-spinner';
      el.textContent = 'Thinking';
      el.style.cssText = 'position:fixed;left:8px;top:8px;display:block;min-width:1px;min-height:1px;z-index:2147483647;';
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 12_000);
    });

    const spinner = page.getByRole('status', { name: 'Thinking' });
    await expect(spinner).toBeVisible();
    // At the 10s mark the spinner is still present: a real 12s spinner would
    // violate WL-5 and fail the toBeHidden({ timeout: 10s }) checks above.
    await page.waitForTimeout(10_000);
    await expect(spinner).toBeVisible();
  });
});
