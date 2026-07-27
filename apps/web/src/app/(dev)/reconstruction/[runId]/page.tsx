import ReconstructionViewer from '@/components/commonplace/scene-host/ReconstructionViewer';

interface ReconstructionRunPageProps {
  params: Promise<{ runId: string }>;
}

export default async function ReconstructionRunPage({ params }: ReconstructionRunPageProps) {
  const { runId } = await params;
  return (
    <main
      className="commonplace-theme"
      style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px 80px' }}
    >
      <ReconstructionViewer runId={decodeURIComponent(runId)} />
    </main>
  );
}
