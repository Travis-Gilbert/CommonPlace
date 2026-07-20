// SOURCING: @playwright/test. The typography gate
// (31-HANDOFF-PROACTIVITY-COMMIT-LANGUAGE P4), built in the shape
// paint-audit.ts established for X2: resolve what the register says a thing
// should be, scan what the page actually computed, and prove the scan can fail
// before trusting a clean result.
//
// The defect this exists to kill is named in the handoff: "variation by
// authorship is the system; variation by accident is a defect". The register
// lint already forbids wrong colors. Nothing forbade wrong faces, so faces
// drifted, and the drift was invisible precisely because every individual
// choice looked reasonable in isolation.
//
// The law lives in src/views/proactivity/typography.ts and is mirrored here as
// the token behind each face, because this scan runs in the page and cannot
// import app modules. The two must agree; the SELF-TEST below is what makes a
// disagreement fail rather than silently pass.

import { expect, type Page } from '@playwright/test';

/** The register variable behind each face utility the law can emit. Mirrors
 *  LAW_FACES in src/views/proactivity/typography.ts. */
export const FACE_TOKEN: Record<string, string> = {
  'font-cp-title': '--cp-font-title',
  'font-cp-agent': '--cp-font-agent',
  'font-cp-human': '--cp-font-human',
  'font-ij-mono': '--ij-font-mono',
};

/** Which faces a role may wear. A title or a body says who is speaking, so it
 *  may wear either speaker's face; machinery is author-invariant and may wear
 *  exactly one. */
export const ROLE_FACES: Record<string, readonly string[]> = {
  title: ['font-cp-title', 'font-cp-agent'],
  body: ['font-cp-human', 'font-cp-agent'],
  machine: ['font-ij-mono'],
};

/** Roles that must actually RENDER on the proactivity surface. A role cannot
 *  pass the audit by not appearing: an unmarked surface is the same drift as a
 *  mis-faced one, just harder to see. */
export const REQUIRED_ROLES = ['title', 'body', 'machine'];

export interface TypeFinding {
  readonly role: string;
  readonly speaker: string | null;
  readonly text: string;
  readonly actual: string;
  readonly allowed: readonly string[];
}

/** Runs the scan in the page and returns every governed element that wears a
 *  face outside its role's mapping. */
export async function auditType(page: Page): Promise<{ findings: TypeFinding[]; seen: string[]; counted: number }> {
  return page.evaluate(
    ([roleFaces, faceToken]) => {
      const resolve = (token: string) => {
        const probe = document.createElement('div');
        probe.style.fontFamily = `var(${token})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).fontFamily;
        probe.remove();
        return value;
      };

      // Resolve each face token once: a hundred rows must not each mount a probe.
      const resolved: Record<string, string> = {};
      for (const [face, token] of Object.entries(faceToken)) resolved[face] = resolve(token);

      const findings: TypeFinding[] = [];
      const seen = new Set<string>();
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-type-role]')];

      for (const node of nodes) {
        const role = node.dataset.typeRole ?? '';
        const faces = roleFaces[role];
        if (!faces) continue;
        seen.add(role);

        // A declared speaker narrows the allowance to exactly one face: that is
        // the authorship claim, and it is the part that carries meaning.
        const speaker = node.dataset.typeSpeaker ?? null;
        const allowed =
          speaker === 'human'
            ? [role === 'machine' ? 'font-ij-mono' : role === 'title' ? 'font-cp-title' : 'font-cp-human']
            : speaker === 'agent'
              ? [role === 'machine' ? 'font-ij-mono' : 'font-cp-agent']
              : faces;

        const actual = getComputedStyle(node).fontFamily;
        if (!allowed.some((face) => resolved[face] === actual)) {
          findings.push({
            role,
            speaker,
            text: (node.textContent ?? '').trim().slice(0, 60),
            actual,
            allowed: allowed.map((face) => `${face} = ${resolved[face]}`),
          });
        }
      }

      return { findings, seen: [...seen], counted: nodes.length };
    },
    [ROLE_FACES, FACE_TOKEN] as const,
  ) as Promise<{ findings: TypeFinding[]; seen: string[]; counted: number }>;
}

/**
 * The assertion, plus the self-test that proves the scan can fail. A gate that
 * cannot fail is decoration: the probe is a governed element wearing a face
 * from outside its role's mapping, and the REAL scan must report it before a
 * clean result on the real surface means anything.
 */
export async function expectEveryFaceLawful(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.id = '__type-probe';
    probe.dataset.typeRole = 'machine';
    probe.dataset.typeSpeaker = 'agent';
    // Machinery is JetBrains Mono, always. A serif here is exactly the
    // accidental variation the law calls a defect.
    probe.style.fontFamily = 'Georgia, serif';
    probe.textContent = 'probe';
    document.body.append(probe);
  });
  const probed = await auditType(page);
  await page.evaluate(() => document.getElementById('__type-probe')?.remove());
  expect(
    probed.findings.some((finding) => finding.text === 'probe'),
    'the mismatched-face probe was NOT caught; the typography scan is inert',
  ).toBe(true);

  const { findings, seen, counted } = await auditType(page);
  expect(
    findings,
    `text wearing a face outside the typography law: ${JSON.stringify(findings, null, 2)}`,
  ).toEqual([]);
  for (const role of REQUIRED_ROLES) {
    expect(seen, `no element on the surface declared the "${role}" role`).toContain(role);
  }
  // A surface that marked three elements and passed would prove nothing.
  expect(counted, 'too few governed elements to be the real surface').toBeGreaterThan(20);
}
