/**
 * Server action for parent login.
 *
 * Wraps next-auth's signIn() and translates AuthError types into i18n keys
 * the client renders. Redirect on success uses next/navigation/redirect so
 * the URL switches to /[lang]/ before any JS runs on the client.
 */

'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '../../../auth';

export type LoginErrorKey = 'invalidCredentials' | 'error' | undefined;

export async function login(
  _prevState: LoginErrorKey,
  formData: FormData,
): Promise<LoginErrorKey> {
  const lang = (formData.get('lang') as string | null) ?? 'he';
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return error.type === 'CredentialsSignin' ? 'invalidCredentials' : 'error';
    }
    throw error;
  }
  redirect(`/${lang}/`);
}
