// SOURCING: none. Root redirects to the Chat surface route (B3).
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/chat');
}
