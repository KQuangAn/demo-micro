import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions = {
  // Configure one or more authentication providers
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: {
          label: 'Username',
          type: 'text',
          placeholder: 'Enter your username',
        },
        password: {
          label: 'Password',
          type: 'password',
          placeholder: 'Enter your password',
        },
      },
      async authorize(credentials) {
        // Replace this with your own user authentication logic
        const user = { id: 1, name: 'User', username: credentials?.username };

        if (
          credentials?.username === 'admin' &&
          credentials?.password === 'password'
        ) {
          return user; // Return user object if authentication is successful
        } else {
          return null; // Return null if authentication fails
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    register: '/register',
  },
};

export const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
