'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

export type TemporaryPasswordState =
  | { kind: 'created' | 'reset'; email: string; password: string }
  | null;

/**
 * Shows a temporary password ONCE. The value lives only in the parent's state
 * and is dropped when this closes; the API never returns it again.
 */
export function TemporaryPasswordDialog({
  state,
  onClose,
}: {
  state: TemporaryPasswordState;
  onClose: () => void;
}) {
  const t = useTranslations('staffPage');
  const [copied, setCopied] = useState(false);
  // Kept only for the closing animation; the parent has already dropped the
  // password, and this unmounts with the dialog.
  const [shown, setShown] = useState<TemporaryPasswordState>(null);
  if (state !== null && state !== shown) setShown(state);

  async function copy() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.password);
      setCopied(true);
    } catch {
      // Clipboard refused (permissions, http): the field is selectable by hand.
    }
  }

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        // Fires once the close has finished: forget the password for good.
        onCloseAutoFocus={() => setShown(null)}
      >
        <DialogHeader>
          <DialogTitle>
            {shown?.kind === 'reset' ? t('secret.resetTitle') : t('secret.createdTitle')}
          </DialogTitle>
          <DialogDescription>{t('secret.body', { email: shown?.email ?? '' })}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            readOnly
            value={shown?.password ?? ''}
            aria-label={t('secret.label')}
            className="font-mono"
            onFocus={(event) => event.currentTarget.select()}
            data-testid="temporary-password"
          />
          <Button variant="outline" onClick={() => void copy()} data-testid="copy-password">
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? t('secret.copied') : t('secret.copy')}
          </Button>
        </div>
        <Alert className="border-highlight">
          <AlertTitle>{t('secret.warningTitle')}</AlertTitle>
          <AlertDescription>{t('secret.warning')}</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button
            onClick={() => {
              setCopied(false);
              onClose();
            }}
            data-testid="secret-done"
          >
            {t('secret.done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
