import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { githubHarnessIdentity, isOwnerGithubLogin } from '@/lib/account-identity';
import { githubAuthCredentials } from '@/lib/auth-config';

const github = githubAuthCredentials({
  AUTH_GITHUB_ID: process.env.AUTH_GITHUB_ID,
  AUTH_GITHUB_SECRET: process.env.AUTH_GITHUB_SECRET,
});

export const { auth, handlers } = NextAuth({
  // Railway terminates TLS before the Next.js process. AUTH_URL pins the
  // canonical public origin; trustHost admits the forwarded production host.
  trustHost:
    process.env.AUTH_TRUST_HOST === 'true' || process.env.NODE_ENV === 'development',
  providers: github ? [GitHub(github)] : [],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === 'github') {
        token.githubLogin = typeof profile?.login === 'string' ? profile.login : undefined;
        token.providerAccountId = account.providerAccountId;
      }
      token.isOwner =
        token.githubLogin !== undefined
          ? isOwnerGithubLogin(token.githubLogin)
          : token.isOwner ?? false;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.isOwner = token.isOwner === true;
        session.user.githubLogin =
          typeof token.githubLogin === 'string' ? token.githubLogin : undefined;
        session.user.harnessIdentity = githubHarnessIdentity(token.providerAccountId);
      }
      return session;
    },
  },
});
