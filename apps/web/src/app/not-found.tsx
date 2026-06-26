import type { Metadata } from 'next';
import Link from 'next/link';
import RoughBox from '@/components/rough/RoughBox';

export const metadata: Metadata = {
  title: 'Case Not Found',
};

export default function NotFound() {
  return (
    <div className="py-16 md:py-24 text-center max-w-lg mx-auto">
      <RoughBox padding={32} tint="terracotta">
        <p className="font-mono-alt text-6xl text-terracotta mb-4 font-bold">
          404
        </p>
        <h1 className="font-title text-2xl font-bold mb-4">Case Not Found</h1>
        <p className="text-ink-secondary mb-6">
          The page you&apos;re looking for has either been moved, removed, or
          never existed. These things happen in the field.
        </p>
        <p className="font-mono-alt text-xs text-ink-faint mb-6">
          &gt; ERR_CASE_FILE_NOT_FOUND
        </p>
        <Link
          href="/"
          className="font-mono text-sm hover:text-terracotta-hover"
        >
          &larr; Return to base
        </Link>
      </RoughBox>
    </div>
  );
}
