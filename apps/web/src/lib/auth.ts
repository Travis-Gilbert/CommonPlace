import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { githubHarnessIdentity, isOwnerGithubLogin } from '@/lib/account-identity';

export const { auth, handlers, signIn, signOut } = NextAuth({
  // Railway terminates TLS in front of the Next.js process. Set AUTH_TRUST_HOST=true
  // in Railway (or any reverse-proxied deployment) so OAuth uses the forwarded public
  // host instead of the internal 0.0.0.0 address.
  trustHost: process.env.AUTH_TRUST_HOST === 'true',
  providers: [GitHub],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === 'github') {
        token.githubLogin = typeof profile?.login === 'string' ? profile.login : undefined;
        token.providerAccountId = account.providerAccountId;
      }
      token.isOwner = isOwnerGithubLogin(token.githubLogin);
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
  pages: {
    error: '/api/auth/error',
  },
});
