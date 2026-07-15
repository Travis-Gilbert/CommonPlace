import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

// Only allow Travis's GitHub account to authenticate.
// All other GitHub users are rejected at sign-in.
const ALLOWED_GITHUB_USERNAME = 'Travis-Gilbert';
const LOCAL_DEV_ONLY_AUTH_SECRET = crypto.randomUUID();
const authSecret =
  process.env.AUTH_SECRET
  ?? (process.env.NODE_ENV === 'production' ? undefined : LOCAL_DEV_ONLY_AUTH_SECRET);

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: authSecret,
  providers: [GitHub],
  callbacks: {
    async signIn({ profile }) {
      // Restrict access to the site owner's GitHub account
      return profile?.login === ALLOWED_GITHUB_USERNAME;
    },
    async session({ session, token }) {
      // Attach isOwner flag to the session object
      if (session.user) {
        (session.user as any).isOwner = true;
      }
      return session;
    },
  },
  pages: {
    error: '/api/auth/error',
  },
});
