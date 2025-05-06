import { getAuth, getCsrfToken } from '@repo/auth';
import RegisterButton from '../../components/button';

export default async function SignIn() {
  const csrfToken = await getCsrfToken();
  const session = await getAuth();
  console.log(session, 1241234);

  return (
    <form method="post" action="/api/auth/callback/credentials">
      <input name="csrfToken" type="hidden" defaultValue={csrfToken} />

      <button type="submit">Sign in</button>
      <div> Or </div>
      <RegisterButton />
    </form>
  );
}
