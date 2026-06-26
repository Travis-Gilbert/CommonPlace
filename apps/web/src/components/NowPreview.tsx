import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import RoughBox from './rough/RoughBox';

interface NowData {
  updated: string;
  researching: string;
  researching_context?: string;
  reading: string;
  reading_context?: string;
  building: string;
  building_context?: string;
  listening: string;
  listening_context?: string;
  thinking?: string;
}

function getNowData(): NowData | null {
  const filePath = path.join(process.cwd(), 'src', 'content', 'now.md');
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);
  return data as NowData;
}

const QUADRANTS: {
  label: string;
  field: keyof Omit<NowData, 'updated' | 'researching_context' | 'reading_context' | 'building_context' | 'listening_context' | 'thinking'>;
  color: string;
}[] = [
  { label: 'Researching', field: 'researching', color: 'var(--color-terracotta)' },
  { label: 'Reading', field: 'reading', color: 'var(--color-teal)' },
  { label: 'Building', field: 'building', color: 'var(--color-gold)' },
  { label: 'Listening to', field: 'listening', color: 'var(--color-success)' },
];

/**
 * NowPreview: shows a snapshot of current focus areas in a 2x2 grid.
 * Data comes from src/content/now.md (single manually updated file).
 * Server Component: reads at build time.
 */
export default function NowPreview() {
  const data = getNowData();
  if (!data) return null;

  return (
    <RoughBox padding={24} tint="neutral" elevated>
      <span
        className="font-mono block mb-3"
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-ink-muted)',
        }}
      >
        Right now
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {QUADRANTS.map((q) => (
          <div key={q.field}>
            <span
              className="font-mono block mb-1.5"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: q.color,
              }}
            >
              {q.label}
            </span>
            <span className="font-title text-[15px] font-semibold text-ink">
              {data[q.field]}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/now"
        className="block mt-4 font-mono text-[11px] uppercase tracking-widest text-ink-faint hover:text-terracotta transition-colors no-underline"
      >
        See more &rarr;
      </Link>
    </RoughBox>
  );
}
