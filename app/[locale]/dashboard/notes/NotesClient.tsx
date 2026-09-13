'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Form } from 'radix-ui';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  apiAdminListNotes,
  apiAdminReplyToNote,
  apiListMyNotes,
  apiRaiseNote,
  type AdminNote,
  type CustomerNote,
  type NoteKind,
} from '@/lib/api/orders';

const KINDS: NoteKind[] = ['NUDGE', 'COMPLAINT', 'NOTE'];

const MUTED_LABEL = 'text-xs tracking-wider text-muted-foreground uppercase';

/**
 * One screen, two jobs, chosen by role.
 *
 * A customer raises notes and reads replies; an admin works the queue. They are
 * the same subject matter and the same route in the table, so splitting them
 * into two pages would duplicate the list rendering to no benefit — but the
 * WRITE paths are entirely separate and gated server-side, which is the part
 * that matters.
 */
export function NotesClient({ isAdmin }: { isAdmin: boolean }) {
  return isAdmin ? <AdminQueue /> : <MyNotes />;
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

function MyNotes() {
  const t = useTranslations('notesPage');
  const tk = useTranslations('notes');
  const fieldId = useId();

  const [notes, setNotes] = useState<CustomerNote[] | null>(null);
  const [kind, setKind] = useState<NoteKind>('NOTE');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => apiListMyNotes().then(setNotes).catch(() => setError('!'));
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiRaiseNote({ kind, body });
      setBody('');
      await load();
    } catch {
      setError('!');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Radix's Form primitive renders a real HTML form element: Enter and the submit
          button behave as they always did. */}
      <Form.Root onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-kind`}>{t('kind')}</Label>
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as NoteKind)}
            name="kind"
          >
            <SelectTrigger
              id={`${fieldId}-kind`}
              className="w-full bg-card"
              data-testid="note-kind"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {tk(k.toLowerCase() as 'nudge' | 'complaint' | 'note')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-body`}>{t('body')}</Label>
          <Textarea
            id={`${fieldId}-body`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            className="min-h-20 bg-card"
            name="body"
          />
        </div>

        <div>
          <Button type="submit" size="lg" disabled={busy || !body.trim()}>
            {busy ? t('sending') : t('submit')}
          </Button>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Form.Root>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('mine')}</h2>
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
                    <strong className="text-sm">
                      {tk(n.kind.toLowerCase() as 'nudge' | 'complaint' | 'note')}
                    </strong>
                    <p className="wrap-anywhere">{n.body}</p>
                    {n.adminReply ? (
                      <Reply label={t('reply')} text={n.adminReply} />
                    ) : (
                      <span className={MUTED_LABEL}>{t('awaiting')}</span>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
