// SOURCING: @/components/ui/progress (Base UI Progress) for the IoU meters; in-repo RoughBox/RoughLine
// for cards and dividers; the gate-check list is trivial static markup. Page-level composition otherwise.
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/lib/icons/iconoir';
import RoughBox from '@/components/rough/RoughBox';
import RoughLine from '@/components/rough/RoughLine';
import {
  Progress,
  ProgressIndicator,
  ProgressLabel,
  ProgressTrack,
  ProgressValue,
} from '@/components/ui/progress';

export const metadata: Metadata = {
  title: 'Theorem Pet',
  description:
    'A designed roster of nine pet creatures, each a distinct silhouette, guarded by a build-time perceptual gate. Every creature is a pure function of its seed on theorem-form, the deterministic generator.',
};

const pixel = { imageRendering: 'pixelated' as const };

type Creature = {
  name: string;
  noun: string;
  archetype: string;
  twist: string;
  flaw: string;
  isNew?: boolean;
};

const ROSTER: Creature[] = [
  { name: 'moss', noun: 'hedgehog', archetype: 'Orb', twist: 'its back is a mossy stone', flaw: 'one crooked sprout on the shell' },
  { name: 'thorn', noun: 'lizard', archetype: 'Biped', twist: 'its spine is a climbing bramble', flaw: 'one thorn bent inward' },
  { name: 'brook', noun: 'river pup', archetype: 'Quadruped', twist: 'its haunches pool like a water drop', flaw: 'an off-center cheek bubble' },
  { name: 'gale', noun: 'fledgling', archetype: 'Winged', twist: 'its wings trail off into wind', flaw: 'one bent tail feather' },
  { name: 'coil', noun: 'cobra', archetype: 'Serpentine', twist: 'its hood flares from a coiled base', flaw: 'one scale chipped on the hood' },
  { name: 'sprout', noun: 'seedling', archetype: 'Sprout', twist: 'its crown is a living leaf', flaw: 'one leaf furled shut' },
  { name: 'ember', noun: 'salamander', archetype: 'Teardrop', twist: 'its tail is a live flame', flaw: 'one ear singed shorter' },
  { name: 'shade', noun: 'bat', archetype: 'Amorphous', twist: 'it is cloaked in its own shadow', flaw: 'one visible mismatched eye' },
  { name: 'rune', noun: 'dino hatchling', archetype: 'Saurian', twist: 'its belly bears a living hazard rune', flaw: 'one foreclaw outgrows the rest', isNew: true },
];

const GATE_CHECKS: { label: string; note: string }[] = [
  { label: 'no two families collapse to the same shape', note: 'max IoU 0.67 < 0.70' },
  { label: 'every creature survives four-tone grayscale', note: '≥ 3 levels' },
  { label: 'palette economy holds', note: '≤ 4 hue clusters' },
  { label: 'each render fits its declared archetype', note: '9 / 9' },
  { label: 'identity survives level growth', note: 'intra-family band' },
];

const IOU_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

// The perceptual gate fails the build above this pairwise-IoU threshold.
const IOU_GATE = 0.7;

const IOU_BARS: {
  label: string;
  value: number;
  tone: 'before' | 'after';
  foot: ReactNode;
}[] = [
  {
    label: 'Before — the roster of rounded lumps (worst pair)',
    value: 0.89,
    tone: 'before',
    foot: 'orb and winged rendered as near-identical balls · mean 0.70',
  },
  {
    label: 'After — the designed 9-creature set (worst pair)',
    value: 0.67,
    tone: 'after',
    foot: (
      <>
        coil vs rune — a risen cobra and a horned dino · mean 0.55 ·{' '}
        <span className="font-mono text-gold">
          gate ratcheted to 0.70 — below the old roster&rsquo;s MEAN
        </span>
      </>
    ),
  },
];

export default function TheoremPetPage() {
  return (
    <div className="space-y-12 py-4 sm:py-8">
      <section className="space-y-4">
        <span className="block font-mono text-sm font-bold uppercase tracking-[0.1em] text-terracotta">
          Theorem · Pet · Creature design gates
        </span>
        <h1 className="max-w-3xl font-title text-3xl font-bold leading-tight md:text-5xl">
          A designed roster, not a family of lumps.
        </h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-ink-secondary">
          Nine pet creatures, each committing to one distinct silhouette &mdash; and a build-time
          perceptual gate that fails the build if the set ever collapses back toward near-identical
          rounded blobs. Every creature is a pure function of its seed on{' '}
          <span className="font-mono text-ink">theorem-form</span>, the deterministic generator.
        </p>
        <p className="max-w-2xl border-l-2 border-gold pl-3 text-sm leading-relaxed text-ink-secondary">
          The design-gate spec targeted a creature catalog that was already stripped. Rather than
          resurrect it, the gates land on the one generator that survived &mdash;{' '}
          <span className="font-semibold text-ink">one generator, no rival</span>.
        </p>
      </section>

      <section className="space-y-4">
        <RoughLine label="New arrival · a Guilmon homage" labelColor="var(--color-terracotta)" />
        <RoughBox tint="gold" variant="dark" padding={20}>
          <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/theorem-pet/rune.png"
              alt="A red pixel dino with horn-ears, a determined face, a pale belly, and clawed feet, in two idle frames."
              width={512}
              height={256}
              style={pixel}
              className="w-full"
            />
            <div className="space-y-1.5">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-terracotta">
                &#9670; rune &middot; added to the roster
              </p>
              <h2 className="m-0 font-title text-2xl font-bold text-cream">rune</h2>
              <p className="font-mono text-sm uppercase tracking-[0.06em] text-gold">
                Saurian &middot; dino hatchling
              </p>
              <p className="pt-1 text-[15px] text-cream/90">
                &ldquo;its belly bears a living hazard rune&rdquo;
              </p>
              <p className="text-sm text-cream/60">&#10022; one foreclaw outgrows the rest</p>
              <p className="pt-2 text-[13px] leading-relaxed text-cream/60">
                Front-facing so the horn-ears, big head, and clawed feet carry the read while the body
                stays mirror-symmetric &mdash; the iconic tail is{' '}
                <span className="text-cream">implied-behind</span>. Its red comes from a new{' '}
                <span className="text-cream">hazard</span> ramp; a rune can still hatch in any palette,
                because shape is the species and colour is the seed&rsquo;s.
              </p>
            </div>
          </div>
        </RoughBox>
      </section>

      <section className="space-y-4">
        <RoughLine label="The full roster · idle bounce" labelColor="var(--color-gold)" />
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="md:sticky md:top-6 md:self-start">
            <RoughBox variant="dark" padding={14}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/theorem-pet/roster.png"
                alt="Nine pixel creatures, each a distinct silhouette, rendered on a dark screen in two idle frames."
                width={784}
                height={3536}
                style={pixel}
                className="w-full"
              />
              <p className="pt-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-cream/50">
                9 families &middot; 2 idle ticks
              </p>
            </RoughBox>
          </div>
          <div className="space-y-3">
            {ROSTER.map((c) => (
              <RoughBox key={c.name} tint={c.isNew ? 'terracotta' : 'neutral'} padding={16}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-title text-lg font-bold">
                    {c.name}{' '}
                    <span className="text-sm font-normal text-ink-secondary">{c.noun}</span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs uppercase tracking-[0.06em] text-gold">
                    {c.archetype}
                    {c.isNew ? ' ◆' : ''}
                  </span>
                </div>
                <p className="mt-1.5 text-[15px]">{c.twist}</p>
                <p className="mt-0.5 text-[13px] text-ink-secondary">
                  <span className="font-semibold text-ink">flaw:</span> {c.flaw}
                </p>
              </RoughBox>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <RoughLine label="Distinctness · pairwise silhouette IoU" labelColor="var(--color-terracotta)" />
        <div className="grid max-w-2xl gap-6">
          {IOU_BARS.map((bar) => (
            <Progress
              key={bar.tone}
              value={bar.value}
              max={1}
              format={IOU_FORMAT}
              className="space-y-1.5"
            >
              <div className="flex items-baseline justify-between text-sm">
                <ProgressLabel className="text-ink-secondary">{bar.label}</ProgressLabel>
                <ProgressValue className="text-ink" />
              </div>
              <ProgressTrack className="bg-border-light">
                <ProgressIndicator className={bar.tone === 'before' ? 'bg-terracotta' : 'bg-teal'} />
                <span
                  aria-hidden
                  className="absolute -top-1 -bottom-1 w-0.5 bg-gold"
                  style={{ left: `${IOU_GATE * 100}%` }}
                />
              </ProgressTrack>
              <p className="text-xs text-ink-secondary">{bar.foot}</p>
            </Progress>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <RoughLine label="What the gate checks · green" labelColor="var(--color-teal)" />
        <ul className="grid gap-2">
          {GATE_CHECKS.map((g) => (
            <li key={g.label} className="flex items-baseline gap-3 font-mono text-sm tabular-nums">
              <span className="font-bold text-teal">&#10003;</span>
              <span className="text-ink">{g.label}</span>
              <span className="ml-auto whitespace-nowrap text-ink-secondary">{g.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border-light pt-6 text-sm text-ink-secondary">
        <span>
          <span className="font-semibold text-teal">theorem-form</span> lib 14 &middot; gates 7 &middot; snapshot repinned
        </span>
        <span>RE-006 <span className="font-semibold text-teal">17/17</span></span>
        <span>
          clippy <span className="font-mono">-D warnings</span> clean
        </span>
        <span>native + wasm <span className="font-semibold text-teal">byte-identical</span></span>
      </section>

      <section className="flex flex-wrap gap-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[0.08em] text-teal no-underline hover:text-teal/80"
        >
          Back to projects <ArrowRight width={14} height={14} strokeWidth={2.5} />
        </Link>
      </section>
    </div>
  );
}
