import { authOptions  ,AuthHandler} from '@repo/auth';

export const handler = AuthHandler(authOptions);

export { handler as GET, handler as POST };
