'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { useCreateStaff } from '@/lib/hooks/use-staff';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Add admin": name and email. The server generates the password. */
export function AddStaffDialog({
  formKey,
  open,
  onOpenChange,
  onCreated,
}: {
  /** Changes on every opening, so the form starts empty. */
  formKey: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (email: string, temporaryPassword: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted per opening (the key), not unmounted on close — so the
            dialog does not flash empty while it animates away. */}
        <AddStaffForm key={formKey} onCancel={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function AddStaffForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (email: string, temporaryPassword: string) => void;
}) {
  const t = useTranslations('staffPage');
  const tErrors = useTranslations('errors');
  const translateApiError = useApiErrorTranslate();
  const fieldId = useId();
  const create = useCreateStaff();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (create.isPending) return;
    setError(null);
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) return setError(t('nameRequired'));
    if (!EMAIL.test(trimmedEmail)) return setError(t('emailInvalid'));

    try {
      const { user, temporaryPassword } = await create.mutateAsync({
        name: trimmedName,
        email: trimmedEmail,
        role: 'ADMIN',
      });
      onCreated(user.email, temporaryPassword);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatApiError(err.body, translateApiError) || tErrors('generic')
          : tErrors('network'),
      );
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('addTitle')}</DialogTitle>
        <DialogDescription>{t('addDescription')}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-name`}>{t('name')}</Label>
          <Input
            id={`${fieldId}-name`}
            value={name}
            maxLength={100}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            data-testid="staff-name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-email`}>{t('email')}</Label>
          <Input
            id={`${fieldId}-email`}
            type="email"
            value={email}
            maxLength={254}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
            data-testid="staff-email"
          />
        </div>
        {error ? (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
          {t('back')}
        </Button>
        <Button onClick={() => void submit()} disabled={create.isPending} data-testid="staff-create">
          {create.isPending ? t('creating') : t('create')}
        </Button>
      </DialogFooter>
    </>
  );
}
