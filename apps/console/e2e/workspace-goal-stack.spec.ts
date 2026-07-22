// SOURCING: @playwright/test. These oracles cover the canonical V2 Console
// routes for the workspace substrate and Goal Stack; upstream responses are
// intercepted at the same-origin boundaries so the real views, graph layout,
// drag-and-drop contract, and revision diff render in the browser.

import { expect, test, type Page, type Route } from '@playwright/test';

const SURFACE_KEY = 'commonplace.console.surface.v1';
const SURFACE_PATHS: Readonly<Record<string, string>> = {
  'console-chat': '/chat',
  'console-workspace': '/workspace',
  'console-index': '/filing',
  'console-docs': '/documents',
  'console-cards': '/cards',
};

async function freshLoad(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate((key) => {
    localStorage.removeItem('commonplace.console.layout-cache.v1');
    localStorage.removeItem(key);
    localStorage.removeItem('commonplace.console.workspace.project.v1');
  }, SURFACE_KEY);
  await page.reload();
  await expect(page.locator('[data-shell]')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-layout-ready', '1', { timeout: 30_000 });
}

async function openSurface(page: Page, id: string) {
  const rail = page.locator(`[data-surface-nav="${id}"]`);
  if (await rail.count()) {
    await rail.click();
  } else {
    // Goal Stack and other secondary surfaces live in the toolbar switcher.
    await page.locator('[data-layout-switcher]').click();
    await page.locator(`[data-layout-option="${id}"]`).click();
  }
  await expect(page.locator('[data-shell]')).toHaveAttribute('data-active-surface', id);
  const path = SURFACE_PATHS[id];
  if (path) await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}/?$`));
}

async function openGoalPlan(page: Page, planId: string) {
  const activeSurface = await page.locator('[data-shell]').getAttribute('data-active-surface');
  if (activeSurface !== 'console-goals') await openSurface(page, 'console-goals');
  const firstTask = page.locator('[data-plan-task]').first();
  if (!await firstTask.isVisible().catch(() => false)) {
    await page.locator('input[aria-label="Plan id"]').fill(planId);
    await page.getByRole('button', { name: 'Open' }).click();
  }
  await expect(firstTask).toBeVisible();
}

test.describe('V2 workspace substrate and Goal Stack', () => {
  test('imports a typed project, reports readiness, and renders exact local history bytes', async ({ page }) => {
    let created = false;
    let findCalls = 0;
    let addedRoot = '';
    let restoreGeneration: number | null = null;
    await page.route('**/api/workspace', async (route) => {
      const body = route.request().postDataJSON() as { query?: string; variables?: Record<string, unknown> };
      const query = body.query ?? '';
      const variables = body.variables ?? {};
      if (query.includes('CreateWorkspaceProject')) {
        created = true;
        return json(route, { data: { createProject: projectReceipt } });
      }
      if (query.includes('AddWorkspaceContentRoot')) {
        addedRoot = String(variables.rootPath);
        return json(route, { data: { addContentRoot: { ...projectReceipt, rootPath: addedRoot } } });
      }
      if (query.includes('WorkspaceSurface')) {
        return json(route, { data: { projectTree, readiness: findCalls === 0 ? buildingReadiness : readyReadiness } });
      }
      if (query.includes('WorkspaceProjectFind')) {
        const degraded = findCalls === 0;
        findCalls += 1;
        return json(route, { data: { search: [projectSearchHit(degraded)] } });
      }
      if (query.includes('WorkspaceFileHistory')) {
        return json(route, { data: { fileHistory } });
      }
      if (query.includes('RestoreWorkspaceRevision')) {
        restoreGeneration = Number(variables.generation);
        return json(route, { data: { restoreRevision: restoredFileHistory } });
      }
      return json(route, { data: { readiness: created ? readyReadiness : buildingReadiness } });
    });

    await freshLoad(page);
    await openSurface(page, 'console-workspace');
    await expect(page.locator('[data-workspace-substrate]')).toBeVisible();
    await expect(page.locator('[data-readiness="building"]')).toHaveText('Building');

    await page.getByLabel('Project name').fill('CommonPlace V2');
    await page.getByLabel('Directory path').fill('/workspace/commonplace');
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page.locator('[data-readiness="building"]')).toHaveText('Building');
    await expect(page.getByRole('treeitem', { name: /src/ })).toBeVisible();
    const excluded = page.getByRole('treeitem', { name: /node_modules/ });
    await expect(excluded).toHaveCSS('opacity', '0.48');

    await page.locator('input[aria-label="Find in project"]').fill('main');
    await page.getByRole('button', { name: 'Find' }).click();
    await expect(page.locator('[data-find-degraded]')).toContainText('trigram');
    await expect(page.getByText('inside project')).toBeVisible();

    await expect(page.locator('[data-readiness="ready"]')).toHaveText('Ready', { timeout: 4_000 });
    await expect(page.locator('[data-find-degraded]')).toHaveCount(0);

    await page.getByLabel('Directory path').fill('/workspace/commonplace/packages');
    await page.getByRole('button', { name: 'Add content root' }).click();
    await expect.poll(() => addedRoot).toBe('/workspace/commonplace/packages');

    await page.getByLabel('File history path').fill('/workspace/commonplace/src/main.ts');
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByText('content-root-imported')).toBeVisible();
    await expect(page.getByText('editor-save')).toBeVisible();
    await expect(page.locator('[data-workspace-history-diff]')).toBeVisible();
    await expect(page.locator('.cm-mergeView')).toBeVisible();
    await expect(page).toHaveScreenshot('workspace-substrate-v2-1440-dark.png', { fullPage: true });

    await page.getByRole('button', { name: 'Restore' }).last().click();
    await expect.poll(() => restoreGeneration).toBe(1);
    await expect(page.getByText('restored-generation-1')).toBeVisible();
  });

  test('renders the canonical plan DAG and queues a destructive affordance through DnD', async ({ page }) => {
    test.setTimeout(120_000);
    const actions: Record<string, unknown>[] = [];
    let approvalRecorded = false;
    await page.route('**/api/harness/plan**', async (route) => {
      if (route.request().method() === 'POST') {
        const action = route.request().postDataJSON() as Record<string, unknown>;
        actions.push(action);
        if (action.action === 'approval_decision') approvalRecorded = true;
        return json(route, { ok: true });
      }
      return json(route, {
        snapshot: planSnapshot(approvalRecorded),
        events: { rows: [] },
        capabilities: capabilityManifest,
        cursor: 7,
      });
    });

    await freshLoad(page);
    await openGoalPlan(page, 'plan-v2');

    await expect(page.locator('[data-plan-task="task-index"]')).toBeVisible();
    await expect(page.locator('[data-plan-task="task-release"]')).toBeVisible();
    const runningEdges = page.locator('[data-goal-edge="running"]');
    await expect.poll(async () => {
      const offset = await runningEdges.first().locator('.goal-edge-progress').getAttribute('stroke-dashoffset').catch(() => null);
      return offset !== null && Math.abs(Number(offset) - 0.42) < 0.001;
    }).toBe(true);
    await expect(page.getByText('Delete generated cache')).toBeVisible();
    await expect(page.getByText('destructive').first()).toBeVisible();
    await expect(page.getByText('locked: plugin.demo.write')).toBeVisible();
    await expect(page.locator('[data-plan-task="task-release"] [data-approval-badge="required"]')).toBeVisible();
    await expect(page.locator('[data-plan-task="task-release"] [data-task-changed]')).toHaveText('Changed');
    await page.locator('[data-plan-task="task-wire"]').click();
    await expect(page.locator('[data-plan-task="task-wire"]')).toHaveAttribute('data-plan-path', 'selected');
    await expect(page.locator('[data-plan-task="task-index"]')).toHaveAttribute('data-plan-path', 'ancestor');
    await expect(page.locator('[data-plan-task="task-release"]')).toHaveAttribute('data-plan-path', 'descendant');
    await expect(page.locator('[data-runs-rail]')).toBeVisible();
    await expect(page).toHaveScreenshot('goal-stack-v2-1440-dark.png', { fullPage: true });

    const source = page.locator('[data-plan-capability="filesystem:delete-cache"]');
    const target = page.locator('[data-plan-task="task-release"]');
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    await expect(target).toHaveAttribute('data-plan-status', 'pending');
    const sourceX = sourceBox!.x + sourceBox!.width / 2;
    const sourceY = sourceBox!.y + sourceBox!.height / 2;
    await page.mouse.move(sourceX, sourceY);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(sourceX + 10, sourceY, { steps: 4 });
    await page.mouse.move(
      targetBox!.x + targetBox!.width / 2,
      targetBox!.y + targetBox!.height / 2,
      { steps: 24 },
    );
    await page.waitForTimeout(200);
    await page.mouse.up();
    await expect.poll(() => actions.at(-1)).toMatchObject({
      planId: 'plan-v2',
      action: 'queue_affordance',
      taskId: 'task-release',
      affordanceRef: 'filesystem:delete-cache',
    });

    await expect(page.locator('[data-plan-permission]')).toContainText('Approval required');
    await page.getByText('Allow once', { exact: true }).click();
    await expect.poll(() => actions.at(-1)).toMatchObject({
      planId: 'plan-v2',
      action: 'approval_decision',
      taskId: 'task-release',
      decision: 'allow',
    });
    await expect(page.locator('[data-plan-permission]')).toHaveCount(0, { timeout: 4_000 });
    await expect(page.getByText('/workspace/commonplace/src/main.ts')).toBeVisible();

    const superseded = page.locator('[data-plan-task="task-old-release"]');
    await expect(superseded).toBeVisible();
    await expect(superseded).toHaveCSS('opacity', '0.46');
    await page.getByRole('button', { name: 'Hide prior generations' }).click();
    await expect(superseded).toHaveCount(0);
    await page.getByRole('button', { name: 'Show prior generations' }).click();
    await expect(superseded).toBeVisible();
    await superseded.click();
    await page.getByRole('button', { name: 'Replan subtree' }).click();
    await expect.poll(() => actions.at(-1)).toMatchObject({
      planId: 'plan-v2',
      action: 'replan_subtree',
      taskId: 'task-old-release',
    });

    approvalRecorded = false;
    await page.setViewportSize({ width: 1024, height: 768 });
    await openGoalPlan(page, 'plan-v2');
    await expect(page.locator('[data-plan-task="task-release"] [data-approval-badge="required"]')).toBeVisible();
    await page.locator('[data-plan-task="task-wire"]').click();
    await expect(page).toHaveScreenshot('goal-stack-v2-1024-dark.png', { fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await openGoalPlan(page, 'plan-v2');
    await page.locator('[data-plan-task="task-wire"]').click();
    await expect.poll(async () => {
      const tools = await page.locator('[data-goal-stack-panel="tools"]').boundingBox();
      const canvas = await page.locator('[data-goal-stack-panel="canvas"]').boundingBox();
      return Boolean(tools && canvas && tools.y < canvas.y);
    }).toBe(true);
    await expect(page).toHaveScreenshot('goal-stack-v2-390-dark.png', { fullPage: true });
  });
});

test('live V2 routes reach GraphQL workspace and Harness Plan together', async ({ page }) => {
  const projectId = process.env.CONSOLE_LIVE_WORKSPACE_PROJECT_ID;
  const planId = process.env.CONSOLE_LIVE_PLAN_ID;
  test.skip(!projectId || !planId, 'Set live workspace and Plan ids to run the deployed substrate oracle.');
  await freshLoad(page);
  await page.evaluate((value) => localStorage.setItem('commonplace.console.workspace.project.v1', value), projectId!);
  await page.reload();
  await openSurface(page, 'console-workspace');
  await expect(page.locator('[data-workspace-substrate]')).toBeVisible();
  await expect(page.locator('[data-readiness]')).toBeVisible();
  await openSurface(page, 'console-goals');
  await page.locator('input[aria-label="Plan id"]').fill(planId!);
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('[data-plan-task]').first()).toBeVisible();
  await expect(page.locator('[data-plan-stream="live"]')).toBeVisible();
});

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

const projectReceipt = {
  projectId: 'project-v2',
  rootId: 'root-v2',
  rootPath: '/workspace/commonplace',
  generation: 2,
};

const buildingReadiness = {
  generation: 0,
  capabilities: [
    { capability: 'find', state: 'Building', missing: ['trigram'] },
    { capability: 'ask', state: 'Building', missing: ['vector'] },
    { capability: 'project_tree', state: 'Ready', missing: [] },
  ],
};

const readyReadiness = {
  generation: 2,
  capabilities: [
    { capability: 'find', state: 'Ready', missing: [] },
    { capability: 'ask', state: 'Ready', missing: [] },
    { capability: 'project_tree', state: 'Ready', missing: [] },
  ],
};

const projectTree = {
  projectId: 'project-v2',
  generation: 2,
  roots: [{
    id: 'root-v2',
    kind: 'ContentRoot',
    name: 'commonplace',
    path: '/workspace/commonplace',
    excluded: false,
    children: [
      {
        id: 'folder-src',
        kind: 'Folder',
        name: 'src',
        path: '/workspace/commonplace/src',
        excluded: false,
        children: [{
          id: 'file-main',
        kind: 'SourceRoot',
          name: 'application sources',
          path: '/workspace/commonplace/src',
          excluded: false,
          children: [],
        }],
      },
      {
        id: 'folder-node-modules',
        kind: 'ExcludedFolder',
        name: 'node_modules',
        path: '/workspace/commonplace/node_modules',
        excluded: true,
        children: [],
      },
    ],
  }],
};

const fileHistory = {
  path: '/workspace/commonplace/src/main.ts',
  revisions: [
    {
      generation: 1,
      hash: 'hash-one',
      label: 'content-root-imported',
      timestampMs: 1_721_300_000_000,
      content: 'export const version = 1;\n',
    },
    {
      generation: 2,
      hash: 'hash-two',
      label: 'editor-save',
      timestampMs: 1_721_300_001_000,
      content: 'export const version = 2;\n',
    },
  ],
};

const restoredFileHistory = {
  ...fileHistory,
  revisions: [
    ...fileHistory.revisions,
    {
      generation: 3,
      hash: 'hash-three',
      label: 'restored-generation-1',
      timestampMs: 1_721_300_002_000,
      content: 'export const version = 1;\n',
    },
  ],
};

function projectSearchHit(degraded: boolean) {
  return {
    item: {
      id: 'item-main',
      kind: 'file',
      title: 'main.ts',
      path: '/workspace/commonplace/src/main.ts',
    },
    score: 0.92,
    originalScore: 0.61,
    insideProject: true,
    degraded,
    missingIndexes: degraded ? ['trigram'] : [],
  };
}

function planSnapshot(approved: boolean) {
  return {
  plan_id: 'plan-v2',
  graph_version: 7,
  plan: {
    id: 'plan-v2',
    title: 'Ship the V2 workspace substrate',
    objective: 'Connect CommonPlace V2 to the canonical workspace and Plan substrate.',
    status: 'active',
    project_id: 'project-v2',
    acceptance_criteria: [{ id: 'F4', text: 'Affordances can be queued from the manifest.' }],
  },
  progress: { done: 1, total: 3 },
  tasks: [
    {
      id: 'task-index',
      alias: 'index',
      title: 'Build the workspace indexes',
      description: 'Materialize search and symbol readiness.',
      kind: 'regular',
      lifecycle_status: 'verified',
      dependencies: [],
      serves: ['F4'],
      acceptance_criteria: ['The trigram index is ready.'],
      queued_affordances: [],
      admission_requirement: 'admitted',
      claim_holder: 'codex-runtime',
      generation_at_start: 1,
      changed_events: [],
    },
    {
      id: 'task-wire',
      alias: 'wire',
      title: 'Wire the V2 substrate',
      description: 'Connect the canonical graph to the V2 product surface.',
      kind: 'regular',
      lifecycle_status: 'running',
      dependencies: ['task-index'],
      serves: ['F4'],
      acceptance_criteria: ['The running edge updates within one poll.'],
      queued_affordances: [],
      progress_fraction: 0.58,
      actor: 'codex-runtime',
      admission_requirement: 'admitted',
      claim_holder: 'codex-runtime',
      generation_at_start: 2,
      changed_events: [],
    },
    {
      id: 'task-release',
      alias: 'release',
      title: 'Release the V2 route',
      description: 'Validate and publish the primary product surface.',
      kind: 'verify',
      lifecycle_status: 'pending',
      dependencies: ['task-wire'],
      serves: ['F4'],
      acceptance_criteria: ['The V2 route renders the canonical graph.'],
      queued_affordances: [{
        ref: 'filesystem:delete-cache',
        config: {},
        annotations: ['destructive'],
      }],
      admission_requirement: approved ? 'admitted' : 'require_approval',
      approval_receipt: approved ? 'approval:plan-v2:task-release' : null,
      generation_at_start: 2,
      changed_events: [{ path: '/workspace/commonplace/src/main.ts', generation: 2 }],
    },
    {
      id: 'task-old-release',
      alias: 'old-release',
      title: 'Retired release attempt',
      description: 'A prior generation retained for replay and bounded replan.',
      kind: 'regular',
      lifecycle_status: 'cancelled',
      plan_status: 'superseded',
      dependencies: ['task-wire'],
      serves: ['F4'],
      acceptance_criteria: ['Superseded generations remain inspectable.'],
      queued_affordances: [],
      admission_requirement: 'admitted',
      superseded_by: ['task-release'],
      changed_events: [],
    },
  ],
  };
}

const capabilityManifest = {
  capabilities: [{
    id: 'filesystem:delete-cache',
    title: 'Delete generated cache',
    description: 'Remove a generated cache directory before rebuilding.',
    server_origin: 'theorem-workspace',
    tool_name: 'delete_cache',
    group: 'affordances',
    grant_state: 'granted',
    annotations: ['destructive'],
  }, {
    id: 'plugin:locked-tool',
    title: 'Locked plugin tool',
    description: 'Requires a missing grant and attaches locked.',
    server_origin: 'plugin-demo',
    tool_name: 'locked_tool',
    group: 'plugin_tools',
    grant_state: 'locked',
    missing_capability: 'plugin.demo.write',
    annotations: ['read_only'],
  }],
};
