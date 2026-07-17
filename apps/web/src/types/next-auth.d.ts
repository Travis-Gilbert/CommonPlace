import 'next-auth';

declare module 'next-auth' {
  interface User {
    isOwner?: boolean;
    githubLogin?: string;
    harnessIdentity?: string;
  }
  interface Session {
    user: User & {
      isOwner?: boolean;
      githubLogin?: string;
      harnessIdentity?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isOwner?: boolean;
    githubLogin?: string;
    providerAccountId?: string;
  }
}
