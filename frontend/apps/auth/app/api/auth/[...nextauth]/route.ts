import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const authOptions = {
  // Configure one or more authentication providers
  providers: [
    Google({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    // ...add more providers here
  ],
};

export const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
