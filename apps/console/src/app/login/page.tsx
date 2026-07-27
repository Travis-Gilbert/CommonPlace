// SOURCING: mode=fork; repository=Mintplex-Labs/anything-llm;
// commit=633fc1960914298009134b40c25007cb422c7884;
// path=frontend/src/pages/Login/index.jsx.

import { LoginPage } from '@/components/fork/LoginPage';

export default async function LoginRoute({
  searchParams,
}: {
  readonly searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <LoginPage
      callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : '/chat'}
    />
  );
}
