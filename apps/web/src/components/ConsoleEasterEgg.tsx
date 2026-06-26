'use client';

import { useEffect } from 'react';

interface ConsoleEasterEggProps {
  essayCount: number;
  fieldNoteCount: number;
  projectCount: number;
  latestEssayTitle: string;
  latestEssaySlug: string;
}

const FUN_FACTS = [
  'This site uses 7 typefaces. Yes, really.',
  'Every hand-drawn border is unique (rough.js randomness).',
  'The dot grid behind you is running spring physics.',
  'No CSS framework components here. Every box is hand-styled.',
  'The paper grain overlay is an SVG feTurbulence filter at 2.5% opacity.',
  'Every icon on section headers draws itself on scroll (pathLength="1" technique).',
];

export default function ConsoleEasterEgg({
  essayCount,
  fieldNoteCount,
  projectCount,
  latestEssayTitle,
  latestEssaySlug,
}: ConsoleEasterEggProps) {
  useEffect(() => {
    // ASCII art header
    console.log(
      '%c\n  ████████╗  ██████╗ \n  ╚══██╔══╝ ██╔════╝ \n     ██║    ██║  ███╗\n     ██║    ██║   ██║\n     ██║    ╚██████╔╝\n     ╚═╝     ╚═════╝ \n',
      'color: #B45A2D; font-family: monospace; font-size: 10px;'
    );

    // Tagline
    console.log(
      '%cYou found the console. Nice.',
      'color: #B45A2D; font-weight: bold; font-size: 14px;'
    );
    console.log(
      '%cInvestigating how design decisions shape human outcomes.',
      'color: #6A5E52; font-size: 12px;'
    );

    // Site stats
    console.log(
      `%cCurrently: ${essayCount} essay${essayCount !== 1 ? 's' : ''}, ${fieldNoteCount} field note${fieldNoteCount !== 1 ? 's' : ''}, ${projectCount} project${projectCount !== 1 ? 's' : ''}`,
      'color: #2D5F6B; font-size: 11px;'
    );

    // Latest essay
    console.log(
      `%cLatest essay: ${latestEssayTitle}\n→ travisgilbert.me/essays/${latestEssaySlug}`,
      'color: #C49A4A; font-size: 11px;'
    );

    // Random fun fact
    const fact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
    console.log(
      `%c✦ ${fact}`,
      'color: #9A8E82; font-size: 11px; font-style: italic;'
    );

    // Tech stack
    console.log(
      '%cBuilt with: Next.js 15, React 19, Tailwind v4, rough.js',
      'color: #9A8E82; font-size: 10px;'
    );

    // CTA
    console.log(
      '%cInterested in the code? See /colophon for how it was built.',
      'color: #B45A2D; font-size: 11px;'
    );
  }, [essayCount, fieldNoteCount, projectCount, latestEssayTitle, latestEssaySlug]);

  return null;
}
