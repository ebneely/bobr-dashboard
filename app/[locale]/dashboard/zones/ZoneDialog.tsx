'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { ApiError, formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  apiAdminCreateZone,
  apiAdminUpdateZone,
  parsePostalPrefixes,
  type DeliveryZone,
} from '@/lib/api/delivery-zones';
import { groszeToZloteInput, zloteToGrosze } from '@/lib/api/orders';

/** What the dialog is doing: nothing, creating, or editing one zone. */
export type ZoneDialogState = { mode: 'create' } | { mode: 'edit'; zone: DeliveryZone } | null;

/** "15.00" → "15,00" for Polish; zloteToGrosze accepts either separator. */
function toInput(grosze: number, locale: string): string {
  const value = groszeToZloteInput(grosze);
  return locale === 'pl' ? value.replace('.', ',') : value;
}

/**
 * Create or edit a zone. Mounted once; the form lives in an inner component
 * keyed by the zone, so each opening starts from that zone's values.
 */
export function ZoneDialog({
  state,
  onOpenChange,
  onSaved,
}: {
  state: ZoneDialogState;
  onOpenChange: (open: boolean) => void;
  onSaved: (zone: DeliveryZone) => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {state ? (
          <ZoneForm
            key={state.mode === 'edit' ? state.zone.id : 'new'}
            zone={state.mode === 'edit' ? state.zone : null}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ZoneForm({
  zone,
  onCancel,
  onSaved,
}: {
  zone: DeliveryZone | null;
  onCancel: () => void;
  onSaved: (zone: DeliveryZone) => void;
}) {
  const t = useTranslations('zonesPage');
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();

  const [namePl, setNamePl] = useState(zone?.namePl ?? '');
  const [nameEn, setNameEn] = useState(zone?.nameEn ?? '');
  const [prefixText, setPrefixText] = useState(zone?.postalCodePrefixes.join(', ') ?? '');
  const [price, setPrice] = useState(zone ? toInput(zone.oneTimeShippingGrosze, locale) : '');
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = parsePostalPrefixes(prefixText);

  async function submit() {
    setError(null);

    if (namePl.trim() === '' || nameEn.trim() === '') {
      setError(t('nameRequired'));
      return;
    }
    if (parsed.invalid.length > 0) {
      setError(t('prefixesInvalid', { tokens: parsed.invalid.join(', ') }));
      return;
    }
    if (parsed.prefixes.length === 0) {
      setError(t('prefixesRequired'));
      return;
    }
    // String parsing, never parseFloat * 100 — see zloteToGrosze.
    const grosze = zloteToGrosze(price);
    if (grosze === null) {
      setError(t('priceInvalid'));
      return;
    }

    const input = {
      namePl: namePl.trim(),
      nameEn: nameEn.trim(),
      postalCodePrefixes: parsed.prefixes,
      oneTimeShippingGrosze: grosze,
      isActive,
    };

    setBusy(true);
    try {
      onSaved(zone ? await apiAdminUpdateZone(zone.id, input) : await apiAdminCreateZone(input));
    } catch (caught) {
      // 409 (a prefix already held by another active zone) and 422 land here,
      // in the dialog, so the admin can fix the field without retyping.
      setError(
        caught instanceof ApiError
          ? formatApiError(caught.body, translateApiError) || t('saveFailed')
          : t('saveFailed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{zone ? t('editTitle') : t('createTitle')}</DialogTitle>
        <DialogDescription>{t('matching')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="zone-name-pl">{t('namePl')}</Label>
          <Input
            id="zone-name-pl"
            name="namePl"
            autoComplete="off"
            value={namePl}
            onChange={(event) => setNamePl(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="zone-name-en">{t('nameEn')}</Label>
          <Input
            id="zone-name-en"
            name="nameEn"
            autoComplete="off"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="zone-prefixes">{t('prefixesLabel')}</Label>
        <Input
          id="zone-prefixes"
          name="postalCodePrefixes"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00, 01, 02"
          value={prefixText}
          aria-invalid={parsed.invalid.length > 0 || undefined}
          aria-describedby="zone-prefixes-hint"
          onChange={(event) => setPrefixText(event.target.value)}
        />
        <p id="zone-prefixes-hint" className="text-xs text-muted-foreground">
          {t('prefixesHint')}
        </p>
        {parsed.prefixes.length > 0 || parsed.invalid.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-1.5"
            aria-label={t('parsed')}
            data-testid="parsed-prefixes"
          >
            {parsed.prefixes.map((prefix) => (
              <Badge key={prefix} variant="secondary" className="font-mono">
                {prefix}
              </Badge>
            ))}
            {parsed.invalid.map((token, index) => (
              <Badge key={`${token}-${index}`} variant="destructive" className="font-mono">
                {token}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="zone-price">{t('price')}</Label>
        <Input
          id="zone-price"
          name="oneTimeShipping"
          inputMode="decimal"
          autoComplete="off"
          className="max-w-40"
          value={price}
          aria-describedby="zone-price-hint"
          onChange={(event) => setPrice(event.target.value)}
        />
        <p id="zone-price-hint" className="text-xs text-muted-foreground">
          {t('priceHint')}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="zone-active" checked={isActive} onCheckedChange={setIsActive} />
        <Label htmlFor="zone-active">{t('isActive')}</Label>
      </div>

      {error ? (
        <Alert variant="destructive" data-testid="zone-error">
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </Button>
        <Button onClick={() => void submit()} disabled={busy} data-testid="zone-submit">
          {zone ? (busy ? t('saving') : t('save')) : busy ? t('creating') : t('create')}
        </Button>
      </DialogFooter>
    </>
  );
}
