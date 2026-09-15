'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { changePassword } from '@/lib/auth/client';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/roles';

export function ProfileClient({
  name,
  email,
  roleLabel,
  mustChangePassword,
  next,
}: {
  name: string;
  email: string;
  roleLabel: string;
  mustChangePassword: boolean;
  /** Validated local path to continue to after a successful change. */
  next: string;
}) {
  const t = useTranslations('profilePage');
  const tErrors = useTranslations('errors');
  const translateApiError = useApiErrorTranslate();
  const fieldId = useId();

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (busy || done) return;
    setError(null);

    if (current === '' || password === '' || confirm === '') {
      setError(t('required'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('mismatch'));
      return;
    }
    if (password === current) {
      setError(t('sameAsCurrent'));
      return;
    }

    setBusy(true);
    let result: Awaited<ReturnType<typeof changePassword>>;
    try {
      result = await changePassword({
        currentPassword: current,
        newPassword: password,
        // Anyone who knew the old (possibly temporary) password is signed out
        // everywhere else. This session is re-issued and stays signed in.
        revokeOtherSessions: true,
      });
    } catch {
      setError(tErrors('network'));
      setBusy(false);
      return;
    }

    if (result.error) {
      const { status, statusText, message, code } = result.error;
      setError(
        formatApiError(
          { statusCode: status, error: statusText, message: message ?? '', code },
          translateApiError,
        ) || tErrors('generic'),
      );
      setBusy(false);
      return;
    }

    setDone(true);
    setCurrent('');
    setPassword('');
    setConfirm('');
    setBusy(false);

    // Held here by the change-password gate: continue where they were headed,
    // with a full navigation so the layout re-reads the cleared flag.
    if (mustChangePassword) window.location.assign(next);
  }

  // No <form> in this app (eslint react/forbid-elements), so Enter submits by hand.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {mustChangePassword && !done ? (
        <Alert data-testid="must-change-password" className="border-highlight">
          <AlertTitle>{t('mustChangeTitle')}</AlertTitle>
          <AlertDescription>{t('mustChangeBody')}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{t('accountTitle')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{t('name')}</dt>
            <dd className="font-medium wrap-anywhere">{name}</dd>
            <dt className="text-muted-foreground">{t('email')}</dt>
            <dd className="font-medium wrap-anywhere">{email}</dd>
            <dt className="text-muted-foreground">{t('role')}</dt>
            <dd>
              <Badge variant="secondary">{roleLabel}</Badge>
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            <h2>{t('passwordTitle')}</h2>
          </CardTitle>
          <CardDescription>{t('passwordHint', { min: MIN_PASSWORD_LENGTH })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4" onKeyDown={onKeyDown}>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-current`}>{t('currentPassword')}</Label>
            <Input
              id={`${fieldId}-current`}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              data-testid="current-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-new`}>{t('newPassword')}</Label>
            <Input
              id={`${fieldId}-new`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="new-password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-confirm`}>{t('confirmPassword')}</Label>
            <Input
              id={`${fieldId}-confirm`}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              data-testid="confirm-password"
            />
          </div>

          {error ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          ) : null}
          {done ? (
            <Alert aria-live="polite" data-testid="password-changed">
              <AlertDescription>
                {mustChangePassword ? t('changedContinuing') : t('changed')}
              </AlertDescription>
            </Alert>
          ) : null}

          <div>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={busy || done}
              data-testid="change-password"
            >
              {busy ? t('saving') : t('submit')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
