// SOURCING: @playwright/test. The proactivity surface's visual and behavioural
// milestone, now in commit language (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE
// P6). The surface still has to do everything PG2 and PG7 required: resolve
// through the registered view, render the five states honestly, show the
// two-sided convergence, and degrade out loud when a source is disabled. What
// P6 adds is that the convergence must now read as a MERGE, a firing must light
// its lineage, candidates must read as uncommitted work ahead of HEAD, and
// every face must obey the typography law, on BOTH themes at 1280 and 1440.
//
// Every check runs under reduced motion, so the reduced-motion pass is the
// baseline: static and legible.
//
// The clock is frozen. Commit rows show relative times ("2d ago"), which is
// correct for a commit graph and fatal for a pixel baseline: without a fixed
// instant these snapshots would rot by one day every day. Freezing it is what
// lets the surface speak in relative time at all.

import { expect, test, type Page } from '@playwright/test';
import { expectEveryFaceLawful } from './type-audit';

/** A fixed instant after the fixture's newest firing (2026-07-18T18:02Z), so
 *  every relative time on the surface is stable and every "Nd ago" is real. */
const FIXED_NOW = new Date('2026-07-19T12:00:00.000Z');

const THEMES = [
  { theme: 'dark', preset: 'intellij-dark' },
  { theme: 'light', preset: 'intellij-light' },
] as const;

const WIDTHS = [1280, 1440] as const;

async function openProactivity(page: Page, width: number = 1440) {
  await page.clock.setFixedTime(FIXED_NOW);
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('commonplace.console.surface.v1');
    window.localStorage.removeItem('commonplace.console.appearance.v1');
    // The store now scopes its key by tenant, so clear every proactivity key.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('commonplace.console.proactivity.v1')) window.localStorage.removeItem(key);
    }
  });
  await page.reload();
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Proactivity is a secondary surface reached through the layout switcher, like
  // Review and Appearance (the coloration IA); it is not in the primary stripe.
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-proactivity"]').click();
  await expect(page.locator('[data-surface="proactivity"]')).toBeVisible();
}

/** Both themes travel the same path, so a signature cannot pass in one mode by
 *  taking a shortcut. Mirrors signatures.spec.ts. */
async function applyTheme(page: Page, preset: string) {
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-appearance"]').click();
  await expect(page.locator('[data-appearance-view]')).toBeVisible();
  await page.locator(`[data-appearance-preset="${preset}"]`).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preset', preset);
  await page.locator('[data-layout-switcher]').click();
  await page.locator('[data-layout-option="console-proactivity"]').click();
  await expect(page.locator('[data-surface="proactivity"]')).toBeVisible();
}

async function openGraph(page: Page) {
  await page.getByRole('tab', { name: 'Graph' }).click();
  await expect(page.getByRole('group', { name: 'The standing proactivity graph' })).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  // Let React Flow's fitView settle before any baseline.
  await page.waitForTimeout(600);
}

/** Compile an intent so PG5 candidates exist to render ahead of HEAD. */
async function compileCandidates(page: Page) {
  await page.getByRole('button', { name: 'I want help with something' }).click();
  await page.locator('#pg-intent').fill('tell me when anyone I owe work to goes quiet');
  await page.getByRole('button', { name: 'Compile it' }).click();
  await expect(page.locator('[data-intent-review]')).toBeVisible();
}

test.describe('Proactivity: the standing program reads as a repository', () => {
  test('the card altitude reads as a grid of card-sized cards, not full-width bars', async ({ page }) => {
    await openProactivity(page);
    // Cards is the default altitude; stakes and programs render as bounded cards
    // in the adopted repo-card grammar.
    await expect(page.locator('[data-node="pg-stake-appeal"]')).toBeVisible();
    await expect(page.getByText('Looks for:').first()).toBeVisible();
    // The repo-card slots carry the proactivity facts (named choice 5).
    await expect(page.locator('[data-slot="repo-card"]').first()).toBeVisible();
    await expect(page.locator('[data-slot="repo-description"]').first()).toBeVisible();
    await expect(page.locator('[data-slot="repo-meta"]').first()).toBeVisible();
  });

  test('the cards carry fire count, last fired, budget, and permission in the repo-card slots', async ({ page }) => {
    await openProactivity(page);
    // The star slot is the fire count; the fork slot is when it last fired.
    await expect(page.getByText(/^fired /).first()).toBeVisible();
    await expect(page.getByText(/^last /).first()).toBeVisible();
    // The license slot is the standing budget; the updated slot is permission.
    await expect(page.getByText(/spend \d+ of \d+/).first()).toBeVisible();
    await expect(page.getByText('will ask you every time').first()).toBeVisible();
    // The over-budget program refuses, in the error tone, on its own card.
    await expect(page.getByText('over budget, not running').first()).toBeVisible();
    // A never-fired program says so rather than showing a bare zero.
    await expect(page.getByText('never fired').first()).toBeVisible();
  });

  test('a derived watch carries the fork badge and a disabled node the archived badge', async ({ page }) => {
    await openProactivity(page);
    // Upstream's fork badge means derived lineage: a watch that fell out of a
    // stake's label rather than being authored.
    await expect(page.locator('[data-fork="true"]').first()).toBeVisible();
    await expect(page.locator('[data-archived="true"]')).toHaveCount(0);
    await page.locator('[data-node="pg-source-email"]').getByRole('button', { name: 'Disable' }).click();
    // Upstream's archived pattern is the disabled state (named choice 5).
    await expect(page.locator('[data-archived="true"]').first()).toBeVisible();
  });

  test('disabling a source degrades its dependent watches with the consequence named', async ({ page }) => {
    await openProactivity(page);
    await page.getByRole('tab', { name: 'Cards' }).click();

    // Email feeds every watch; disabling it must not silently break them.
    await expect(page.getByText('this can no longer see your email')).toHaveCount(0);
    await page.locator('[data-node="pg-source-email"]').getByRole('button', { name: 'Disable' }).click();
    await expect(page.getByText('Degraded: this can no longer see your email').first()).toBeVisible();
  });

  test('the graph renders commit rows, a true merge at the join, and HEAD', async ({ page }) => {
    await openProactivity(page);
    await openGraph(page);

    await expect(page.getByText(/A watch fires only where both converge/)).toBeVisible();

    // Every node is a commit row from the adopted component, with the machinery
    // run its slot order requires.
    await expect(page.locator('[data-slot="commit-entry"]').first()).toBeVisible();
    await expect(page.locator('[data-slot="commit-hash"]').first()).toBeVisible();
    await expect(page.locator('[data-slot="commit-time"]').first()).toBeVisible();

    // The join is a MERGE, not a pipe: the sentence is a picture.
    await expect(page.locator('[data-commit-merge="true"]').first()).toBeVisible();
    // HEAD is the current tip: what actually runs.
    await expect(page.locator('[data-commit-head="true"]').first()).toBeVisible();

    // Rails carry authorship. Both speakers are present in the fixture.
    await expect(page.locator('[data-commit-lane="human"]').first()).toBeVisible();
    await expect(page.locator('[data-commit-lane="agent"]').first()).toBeVisible();

    // No arrowheads: lineage flows by convention in a commit graph.
    await expect(page.locator('.react-flow__edge marker')).toHaveCount(0);
  });

  test('a firing appends an execution commit on the agent lane and lights its lineage', async ({ page }) => {
    await openProactivity(page);
    await openGraph(page);

    // The execution commits: what the agent actually did, each parented to the
    // response commit that authorized it. Every one rides the agent's lane,
    // because an execution has no other possible author.
    const executions = page.locator('[data-node-kind="execution"]');
    await expect(executions.first()).toBeVisible();
    await expect(executions).toHaveCount(4);
    await expect(page.locator('[data-node-kind="execution"][data-commit-lane="agent"]')).toHaveCount(4);
    // The newest firing is the one whose lineage is lit.
    const newest = page.locator('[data-node="pg-fire-book-2"]');
    await expect(newest).toContainText('digest');
    await expect(newest).toHaveAttribute('data-commit-lit', 'true');
    // Relative time is real and stable, because the clock is frozen.
    await expect(page.locator('[data-node="pg-fire-appeal-1"]')).toContainText('3d ago');

    // Its lineage is lit back through the response, judgment, watch, and the
    // sources and stake that fed it.
    await expect(page.locator('[data-commit-lit="true"]').first()).toBeVisible();
    const lit = await page.locator('[data-commit-lit="true"]').count();
    expect(lit, 'a firing lights a whole lineage, not one node').toBeGreaterThan(3);
  });

  test('permission and budget render on every response commit', async ({ page }) => {
    await openProactivity(page);
    await openGraph(page);
    await expect(page.getByText('can act on its own').first()).toBeVisible();
    await expect(page.getByText('asks you every time').first()).toBeVisible();
    await expect(page.getByText('over budget, not running').first()).toBeVisible();
  });

  test('disabling a node renders it as a revert, and undo reverses it', async ({ page }) => {
    await openProactivity(page);
    await expect(page.locator('[data-commit-revert="true"]')).toHaveCount(0);
    await page.locator('[data-node="pg-source-email"]').getByRole('button', { name: 'Disable' }).click();
    await openGraph(page);
    // Disable IS the revert commit (the mapping table); the undo affordance
    // already on the surface is what reverses it, so no new mutation appears.
    await expect(page.locator('[data-commit-revert="true"]').first()).toBeVisible();
    await page.getByRole('button', { name: /^Undo / }).click();
    await expect(page.locator('[data-commit-revert="true"]')).toHaveCount(0);
  });

  test('compiled candidates render as uncommitted commits ahead of HEAD, and discard removes them', async ({ page }) => {
    await openProactivity(page);
    await compileCandidates(page);

    // In the review panel: dashed rows on your lane.
    await expect(page.locator('[data-candidate-list] [data-candidate]').first()).toBeVisible();

    // And on the graph, ahead of HEAD.
    await openGraph(page);
    await expect(page.locator('[data-node-kind="candidate"]').first()).toBeVisible();
    const candidates = await page.locator('[data-node-kind="candidate"]').count();
    expect(candidates, 'a compiled intent makes more than one candidate commit').toBeGreaterThan(1);

    await page.getByRole('tab', { name: 'Cards' }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await openGraph(page);
    await expect(page.locator('[data-node-kind="candidate"]')).toHaveCount(0);
  });

  test('committing candidates lands them on your lane as real commits', async ({ page }) => {
    await openProactivity(page);
    await compileCandidates(page);
    await page.getByRole('button', { name: 'Commit', exact: true }).click();
    await expect(page.getByText('Added to your graph.')).toBeVisible();
    await openGraph(page);
    // No longer uncommitted: they are commits like any other, on the human lane.
    await expect(page.locator('[data-node-kind="candidate"]')).toHaveCount(0);
    await expect(page.locator('[data-commit-lane="human"]').first()).toBeVisible();
  });
});

// The typography law, and the capture set. Both run on both themes, because
// light is not a variant to be checked once: it is the mode that exposes an
// unpainted surface, and a wrong face is exactly as invisible in dark as a
// paint gap.
for (const { theme, preset } of THEMES) {
  test.describe(`Proactivity on ${theme}`, () => {
    test(`every face obeys the typography law on ${theme}`, async ({ page }) => {
      await openProactivity(page);
      await applyTheme(page, preset);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      // The card altitude first: titles, bodies, and machinery all present.
      await expectEveryFaceLawful(page);
      await openGraph(page);
      // Then the graph, where every commit row's message is a title whose face
      // is its author's claim.
      await expectEveryFaceLawful(page);
    });

    for (const width of WIDTHS) {
      test(`cards capture at ${width} on ${theme}`, async ({ page }) => {
        await openProactivity(page, width);
        await applyTheme(page, preset);
        await page.setViewportSize({ width, height: 900 });
        await expect(page.locator('[data-node="pg-stake-appeal"]')).toBeVisible();
        await expect(page).toHaveScreenshot(`proactivity-cards-${width}-${theme}.png`, { fullPage: true });
      });

      test(`graph capture at ${width} on ${theme}, with the merge join and the lit firing`, async ({ page }) => {
        await openProactivity(page, width);
        await applyTheme(page, preset);
        await page.setViewportSize({ width, height: 900 });
        await openGraph(page);
        await expect(page.locator('[data-commit-merge="true"]').first()).toBeVisible();
        await expect(page.locator('[data-commit-lit="true"]').first()).toBeVisible();
        await expect(page).toHaveScreenshot(`proactivity-graph-${width}-${theme}.png`, { fullPage: true });
      });

      test(`candidate capture at ${width} on ${theme}`, async ({ page }) => {
        await openProactivity(page, width);
        await applyTheme(page, preset);
        await page.setViewportSize({ width, height: 900 });
        await compileCandidates(page);
        await openGraph(page);
        await expect(page.locator('[data-node-kind="candidate"]').first()).toBeVisible();
        await expect(page).toHaveScreenshot(`proactivity-candidates-${width}-${theme}.png`, { fullPage: true });
      });
    }
  });
}
