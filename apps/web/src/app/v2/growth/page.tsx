import type { Metadata } from 'next';
import { GrowthSurface } from '@/components/growth/GrowthSurface';

export const metadata: Metadata = {
  title: 'Growth',
};

export default function GrowthPage() {
  return <GrowthSurface />;
}
