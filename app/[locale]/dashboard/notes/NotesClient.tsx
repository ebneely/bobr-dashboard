'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  apiAdminListNotes,
  apiAdminReplyToNote,
  type AdminNote,
} from '@/lib/api/orders';

const MUTED_LABEL = 'text-xs tracking-wider text-muted-foreground uppercase';

/**
 * The staff queue: notes customers raised on the storefront, answered here.
 * Customers raise and read their notes in the storefront account area.
 */
export function NotesClient() {
  return <AdminQueue />;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}

/**
 * The reply is visually attached to the note rather than listed separately: an
 * answer that looks like a new message reads as unrelated.
 */
function Reply({ label, text }: { label: string; text: string }) {
  return (
    <blockquote className="mt-2 border-l-3 border-primary pl-3">
      <span className={MUTED_LABEL}>{label}</span>
      <p>{text}</p>
    </blockquote>
  );
}

function AdminQueue() {
  const t = useTranslations('notesPage');
  const tk = useTranslations('notes');
  const fieldId = useId();

  const [notes, setNotes] = useState<AdminNote[] | null>(null);
  const [unansweredOnly, setUnansweredOnly] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = (only: boolean) =>
    apiAdminListNotes(only).then(setNotes).catch(() => setNotes([]));

  useEffect(() => {
    void load(unansweredOnly);
  }, [unansweredOnly]);

  async function send(id: string) {
    const text = (drafts[id] ?? '').trim();
    if (!text) return;
    setBusy(id);
    try {
      await apiAdminReplyToNote(id, text);
      setDrafts((d) => ({ ...d, [id]: '' }));
      await load(unansweredOnly);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Label htmlFor={`${fieldId}-unanswered`} className="font-normal">
        <Checkbox
          id={`${fieldId}-unanswered`}
          checked={unansweredOnly}
          onCheckedChange={(checked) => setUnansweredOnly(checked === true)}
          data-testid="unanswered-only"
        />
        {t('unansweredOnly')}
      </Label>

      {!notes ? (
        <ListSkeleton />
      ) : notes.length === 0 ? (
        <p className="text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-1">
                  <strong className="text-sm wrap-anywhere">
                    {tk(n.kind.toLowerCase() as 'nudge' | 'complaint' | 'note')}{' '}
                    <span className="font-normal text-muted-foreground">
                      {t('from')} {n.user?.email ?? '—'}
                    </span>
                  </strong>
                  <p className="wrap-anywhere">{n.body}</p>

                  {n.adminReply ? (
                    <Reply label={t('answered')} text={n.adminReply} />
                  ) : (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
                      <Textarea
                        value={drafts[n.id] ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [n.id]: e.target.value }))
                        }
                        placeholder={t('replyPlaceholder')}
                        aria-label={t('replyPlaceholder')}
                        rows={2}
                        maxLength={2000}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => send(n.id)}
                        disabled={busy === n.id || !(drafts[n.id] ?? '').trim()}
                      >
                        {t('sendReply')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
