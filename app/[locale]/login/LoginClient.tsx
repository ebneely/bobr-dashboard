'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { signIn } from '@/lib/auth/client';

export function LoginClient({
  target,
  registerUrl,
}: {
  /** Already validated by the server page — a local path, never a URL. */
  target: string;
  registerUrl: string;
}) {
  const t = useTranslations('login');
  const tErrors = useTranslations('errors');
  const translateApiError = useApiErrorTranslate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);

    if (email.trim() === '' || password === '') {
      setError(t('required'));
      return;
    }

    setBusy(true);
    let result: Awaited<ReturnType<typeof signIn.email>>;
    try {
      result = await signIn.email({ email: email.trim(), password });
    } catch {
      setError(tErrors('network'));
      setBusy(false);
      return;
    }

    if (result.error) {
      const { status, statusText, message, code } = result.error;
      setError(
        // Deliberately the same message whether the address is unknown or the
        // password is wrong: telling them apart tells an attacker which
        // addresses have accounts.
        status === 401
          ? t('invalidCredentials')
          : formatApiError(
              { statusCode: status, error: statusText, message: message ?? '', code },
              translateApiError,
            ) || tErrors('generic'),
      );
      setBusy(false);
      return;
    }

    // A full navigation, not router.push: the dashboard layout has to read the
    // new session cookie on a real request.
    window.location.assign(target);
  }

  // No <form> in this app (eslint react/forbid-elements), so Enter in either
  // field submits by hand.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="login-email">{t('email')}</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="login-password">{t('password')}</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" onClick={() => void submit()} disabled={busy}>
          {busy ? t('submitting') : t('submit')}
        </Button>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-center gap-1 text-sm text-muted-foreground">
        <span>{t('noAccount')}</span>
        <Button asChild variant="link" className="h-auto p-0">
          <a href={registerUrl}>{t('register')}</a>
        </Button>
      </CardFooter>
    </Card>
  );
}
