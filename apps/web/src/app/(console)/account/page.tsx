import { redirect } from 'next/navigation';

/* Identity is the account entry point. Agent credentials and memory remain on
   the Agents tab after the person has signed in. */
export default function AccountIndex() {
  redirect('/account/user');
}
