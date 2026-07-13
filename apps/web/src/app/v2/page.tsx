import { IndexSurface } from '@/components/v2/index/IndexSurface';
import { ActiveRoomsBand } from '@/components/v2/index/ActiveRoomsBand';

/* Index: the daily driver. Everything is filed; this surface reviews what
   landed, what is open, and what today holds -- it never demands. The header is
   server-rendered; the list|detail chassis below is a client island
   (IndexSurface) bound to the contract-first band seam (lib/index-queries). */

export default function IndexPage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="p-top">
        <div className="p-toph">
          <div className="p-kicker">{today}</div>
          <h1 className="p-h1">Index</h1>
        </div>
      </header>

      <ActiveRoomsBand />
      <IndexSurface />
    </div>
  );
}
