// SOURCING: none. Route entry; default lands on the seeded chat view (CS8).
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/v/chat');
}
