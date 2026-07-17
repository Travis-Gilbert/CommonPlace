// SOURCING: @playwright/test. The cards/actions/mentions oracles
// (HANDOFF-CARDS-ACTIONS-MENTIONS K7): live person and task cards render
// through their templates, relation chips navigate, the three sheet entries
// open one identical sheet, the submitted pack equals the visible chip set
// exactly (the named invariant probe of the round), and the mentions
// round-trip confirms and suppresses through the seam. Baselines capture the
// grid, the full card, and the sheet.

import { expect, test, type Page } from '@playwright/test';

async function settled(page: Page) {
  await page.waitForSelector('[data-shell]');
  await page.waitForTimeout(600);
}

async function freshLoad(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.removeItem('commonplace.console.surface.v1'));
  await page.reload();
  await settled(page);
}

async function openSurface(page: Page, surfaceId: string) {
  // Screen navigation is the leftmost stripe's surfaces group.
  await page.locator(`[data-surface-nav="${surfaceId}"]`).click();
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', surfaceId);
}

test.describe('cards, actions, mentions', () => {
  test.beforeEach(async ({ page }) => {
    await freshLoad(page);
  });

  test('the surface rail is the primary nav: far-left, switches screens', async ({ page }) => {
    const rail = page.locator('[data-surface-rail]');
    await expect(rail).toBeVisible();
    // Every seeded surface has a rail entry; the active one marks aria-current.
    await expect(rail.locator('[data-surface-nav]')).toHaveCount(5);
    await expect(rail.locator('[data-surface-nav="console-workspace"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    // Clicking a rail entry switches the surface without the toolbar dropdown.
    await rail.locator('[data-surface-nav="console-cards"]').click();
    await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', 'console-cards');
    await expect(rail.locator('[data-surface-nav="console-cards"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the grid renders live person and task cards through their templates', async ({ page }) => {
    await openSurface(page, 'console-cards');
    const person = page.locator('[data-card-kind="person"]');
    await expect(person).toBeVisible();
    await expect(person.getByText('Ada Lovelace')).toBeVisible();
    await expect(person.getByText('Analyst')).toBeVisible();
    await expect(page.locator('[data-card-kind="task"]')).toBeVisible();
    // Objects of a kind with no template render the generic card, never an
    // error: the org and project cells are present as generic faces.
    await expect(page.locator('[data-card-cell="org-braintrust"] [data-card-kind="generic"]')).toBeVisible();
  });

  test('relation chips are live objects: a chip opens the related card', async ({ page }) => {
    await openSurface(page, 'console-cards');
    await page.locator('[data-card-chip="WORKS_AT"]').first().click();
    const inspector = page.getByLabel('Record inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByText('Braintrust').first()).toBeVisible();
    // The related org has no template of its own: generic card, never an error.
    await expect(inspector.locator('[data-card-kind="generic"]')).toBeVisible();
  });

  test('the full card renders through the descriptor registry with gauge and facts', async ({ page }) => {
    // The arrangement is data: seed a surface hosting card.full over the live
    // task query, exactly as a user arrangement would.
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('commonplace.console.surface.v1');
      const objects = raw ? JSON.parse(raw) : [];
      const filtered = objects.filter(
        (o: { id: string }) => !['e2e-card-surface', 'e2e.region', 'e2e.vi-card'].includes(o.id),
      );
      for (const object of filtered) {
        if (object.type === 'surface') object.properties.active = false;
      }
      filtered.push(
        { id: 'e2e-card-surface', type: 'surface', properties: { name: 'CardProof', kind: 'workspace', active: true }, relations: { CONTAINS: ['e2e.region'] } },
        { id: 'e2e.region', type: 'region', properties: { kind: 'editor', size: 100, active_tab: 'e2e.vi-card' }, relations: { CONTAINS: ['e2e.vi-card'] } },
        { id: 'e2e.vi-card', type: 'view-instance', properties: { descriptor_id: 'card.full', title: 'Task card', query: { types: ['task'], page: { limit: 1 } } }, relations: { CONTAINS: [] } },
      );
      window.localStorage.setItem('commonplace.console.surface.v1', JSON.stringify(filtered));
    });
    await page.reload();
    await settled(page);
    const card = page.locator('[data-card="full"]');
    // The injected surface's card.full queries the task over the live wire on
    // a freshly compiled route; allow headroom so a cold, parallel-loaded dev
    // server does not flake this behavioral assertion.
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByText('Send the compliance report')).toBeVisible();
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    await expect(card.getByText('high')).toBeVisible();
    await expect(card.locator('[data-card-chip="IN_PROJECT"]')).toBeVisible();
  });

  test('the grid virtualizes past 200 cards', async ({ page }) => {
    await page.evaluate(() => {
      const raw = window.localStorage.getItem('commonplace.console.surface.v1');
      const objects = raw ? JSON.parse(raw) : [];
      for (const object of objects) {
        if (object.type === 'surface') object.properties.active = false;
      }
      objects.push(
        { id: 'e2e-grid-surface', type: 'surface', properties: { name: 'GridProof', kind: 'workspace', active: true }, relations: { CONTAINS: ['e2e.grid-region'] } },
        { id: 'e2e.grid-region', type: 'region', properties: { kind: 'editor', size: 100, active_tab: 'e2e.vi-grid' }, relations: { CONTAINS: ['e2e.vi-grid'] } },
        { id: 'e2e.vi-grid', type: 'view-instance', properties: { descriptor_id: 'cards.grid', title: 'Grid proof', query: { types: ['record'], page: { limit: 400 } } }, relations: { CONTAINS: [] } },
      );
      window.localStorage.setItem('commonplace.console.surface.v1', JSON.stringify(objects));
    });
    await page.reload();
    await settled(page);
    await expect(page.locator('[data-cards-grid]')).toBeVisible();
    const rendered = await page.locator('[data-card-cell]').count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(400);
    // Keyboard focus order is row-major: the first two cells are adjacent in
    // tab order because the DOM order is row-major.
    await page.locator('[data-card-cell]').first().focus();
    await page.keyboard.press('Tab');
    const secondId = await page.locator('[data-card-cell]').nth(1).getAttribute('data-card-cell');
    const focusedId = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-card-cell'),
    );
    expect(focusedId).toBe(secondId);
  });

  test('all three entries open the identical sheet; the pack equals the chips', async ({ page }) => {
    // Entry 1: the Action verb from the inspector. Click the title text: a
    // center-click can land on a relation chip, which is its own navigation.
    await openSurface(page, 'console-cards');
    await page.locator('[data-card-cell="person-ada"]').getByText('Ada Lovelace').click();
    await page.locator('[data-inspector-action]').click();
    const sheet = page.locator('[data-action-sheet]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-context-chip="origin"]')).toContainText('Ada Lovelace');

    // The no-silent-context probe (the named invariant test of the round):
    // capture the submitted pack and compare it to the visible chips exactly.
    await sheet.getByLabel('Instruction').fill('review the memoir margins');
    const visibleChips = await sheet.locator('[data-context-chip]').allTextContents();
    const packPromise = page.waitForRequest('**/api/harness/delegate');
    await sheet.getByRole('button', { name: 'Hand off' }).click();
    const request = await packPromise;
    const pack = request.postDataJSON() as {
      instruction: string;
      context: Array<{ label: string }>;
    };
    expect(pack.instruction).toBe('review the memoir margins');
    expect(pack.context.length).toBe(visibleChips.length);
    expect(pack.context[0].label).toBe('Ada Lovelace');
    for (const entry of pack.context) {
      expect(visibleChips.some((text) => text.includes(entry.label))).toBe(true);
    }
    // With the harness delegate unconfigured in e2e, For me renders the
    // named unavailable state and With me remains available (K4).
    await expect(sheet.locator('[data-delegate-refused]')).toContainText('CONSOLE_HARNESS_URL');
    await sheet.locator('[data-destination="with-me"]').click();
    await sheet.getByRole('button', { name: 'Stage in thread' }).click();
    await expect(page.locator('[data-action-sheet]')).toHaveCount(0);
    // Close the inspector: it overlays the right edge of every surface and
    // would intercept the docs entry's todo affordance below.
    await page.getByLabel('Close inspector').click();

    // Entry 2: /do in the composer opens the same sheet, pre-filled.
    await openSurface(page, 'console-workspace');
    const composer = page.locator('[data-thread-composer-input]');
    await expect(composer).toBeVisible();
    // The With-me staging from entry 1 is visible above the composer.
    await expect(page.locator('[data-thread-staged-ref]').first()).toContainText('Ada Lovelace');
    await composer.fill('/do triage the inbox');
    await composer.press('Enter');
    await expect(page.locator('[data-action-sheet]')).toBeVisible();
    await expect(page.getByLabel('Instruction')).toHaveValue('triage the inbox');
    await page.keyboard.press('Escape');

    // Entry 3: the todo-block action icon in a document, and Alt+Enter.
    await openSurface(page, 'console-docs');
    await page.locator('[data-doc-id="doc-console-punch-list"]').click();
    const todoButton = page.locator('[data-todo-action]').first();
    await expect(todoButton).toBeVisible();
    await todoButton.click();
    const todoSheet = page.locator('[data-action-sheet]');
    await expect(todoSheet).toBeVisible();
    await expect(todoSheet.locator('[data-context-chip="origin"]').first()).toContainText(
      'Console punch list',
    );
    await page.keyboard.press('Escape');
    await page.locator('li.task-list-item').first().focus();
    await page.keyboard.press('Alt+Enter');
    await expect(page.locator('[data-action-sheet]')).toBeVisible();
    // Save as rule names its missing capability (IX6) instead of pretending.
    await expect(page.locator('[data-save-as-rule-unavailable]')).toContainText('IX6');
  });

  test('mentions: truthful counts, confirm writes through, dismiss suppresses', async ({ page }) => {
    await openSurface(page, 'console-cards');
    const adaCell = page.locator('[data-card-cell="person-ada"]');
    await expect(adaCell.locator('[data-mentions-chip]')).toHaveText('2');
    // An object with no candidates shows no mentions chrome at all.
    await expect(
      page.locator('[data-card-cell="task-report"] [data-mentions-section]'),
    ).toHaveCount(0);

    await adaCell.getByText('Ada Lovelace').click();
    const inspector = page.getByLabel('Record inspector');
    const summary = inspector.locator('[data-mentions-summary]');
    await expect(summary).toContainText('mentioned in 2 places, 2 unlinked');
    await inspector.locator('[data-mentions-section] button').first().click();
    // The passage highlight matches the recorded span exactly.
    await expect(inspector.locator('[data-mention-span]').first()).toHaveText('Ada Lovelace');

    await inspector.getByRole('button', { name: 'Confirm' }).first().click();
    await expect(summary).toContainText('1 unlinked');
    await expect(inspector.locator('[data-mention-candidate="confirmed"]')).toHaveCount(1);

    await inspector.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(summary).toContainText('mentioned in 1 places, 0 unlinked');
  });

  test('baselines: grid, full card, and the sheet under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await freshLoad(page);
    await openSurface(page, 'console-cards');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-cards-grid]')).toHaveScreenshot('cards-grid.png');

    await page.locator('[data-card-cell="person-ada"]').click();
    await page.waitForTimeout(400);
    await expect(
      page.getByLabel('Record inspector').locator('[data-card="compact"]'),
    ).toHaveScreenshot('card-compact-inspector.png');

    await page.locator('[data-inspector-action]').click();
    const sheet = page.locator('[data-action-sheet]');
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(300);
    // Reduced motion renders the sheet without the material animation.
    const transform = await sheet.evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
    await expect(sheet).toHaveScreenshot('action-sheet.png');
  });
});
