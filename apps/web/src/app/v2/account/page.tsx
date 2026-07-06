import { redirect } from 'next/navigation';

/* Account has no root surface of its own — Agents is the primary subpage
   (almost all migrated surfaces live there). Redirect to it. */
export default function AccountIndex() {
  redirect('/v2/account/agents');
}
