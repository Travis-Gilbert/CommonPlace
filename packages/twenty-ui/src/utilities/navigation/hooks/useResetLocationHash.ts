'use client';

// SOURCING: next/navigation (Next.js App Router), replacing react-router-dom's
// useNavigate/useLocation. Same contract: drop the fragment, keep the path, do
// not add a history entry.

import { usePathname, useRouter } from 'next/navigation';

export const useResetLocationHash = () => {
  const router = useRouter();
  const pathname = usePathname();

  const resetLocationHash = () => {
    router.replace(pathname);
  };

  return { resetLocationHash };
};
