import { AuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from 'next';
const authOptions: AuthOptions = {
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
      async authorize(credentials: any) {
        const res = await fetch('http://localhost:8080/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: credentials?.username,
            password: credentials?.password,
          }),
        });

        const user = await res.json();

        if (!res.ok || !user) {
          throw new Error(user?.message || 'Login failed');
        }

        return user.data;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      return 'http://localhost:3001';
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.user = user;
        token.token = user?.token;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.user = token.user;
      return { ...session, token: token?.token };
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: 'secret', // !!
};

const getAuth = (
  ...args:
    | [GetServerSidePropsContext['req'], GetServerSidePropsContext['res']]
    | [NextApiRequest, NextApiResponse]
    | []
) => {
  return getServerSession(...args, authOptions);
};

export { authOptions, getAuth };
