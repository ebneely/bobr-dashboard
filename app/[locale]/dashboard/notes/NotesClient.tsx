'use client';

import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { PaginationBar } from '@/components/PaginationBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { ApiError, formatApiError, type ApiErrorTranslate } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import {
  apiAdminListNotes,
  apiAdminReplyToNote,
  formatWarsawDate,
  type AdminNote,
  type ComplaintResolution,
} from '@/lib/api/orders';

const MUTED_LABEL = 'text-xs tracking-wider text-muted-foreground uppercase';
const RESOLUTIONS: readonly ComplaintResolution[] = ['ACCEPTED', 'REJECTED', 'INFO'];
const LIMIT = 50;

function describeError(
  error: unknown,
  fallback: string,
  translate: ApiErrorTranslate,
): string {
  if (error instanceof ApiError) return formatApiError(error.body, translate) || fallback;
  return fallback;
}

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
  const translateApiError = useApiErrorTranslate();
  const locale = useLocale();
  const fieldId = useId();

  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState<AdminNote[] | null>(null);
  const [total, setTotal] = useState(0);
  const [unansweredOnly, setUnansweredOnly] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [resolutions, setResolutions] = useState<Record<string, ComplaintResolution | ''>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The note whose "already answered — overwrite?" confirmation is open, if any. */
  const [confirmOverwrite, setConfirmOverwrite] = useState<AdminNote | null>(null);

  function load(only: boolean, atPage: number) {
    apiAdminListNotes(only, atPage, LIMIT)
      .then(({ items, total: totalCount }) => {
        setNotes(items);
        setTotal(totalCount);
        setError(null);
      })
      .catch((err: unknown) => {
        setNotes([]);
        setError(describeError(err, t('loadFailed'), translateApiError));
      });
  }

  useEffect(() => {
    load(unansweredOnly, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unansweredOnly, page]);

  function toggleUnanswered(checked: boolean) {
    setUnansweredOnly(checked);
    setPage(1);
  }

  async function send(note: AdminNote, overwrite = false) {
    const text = (drafts[note.id] ?? '').trim();
    if (!text) return;
    setBusy(note.id);
    setError(null);
    try {
      await apiAdminReplyToNote(note.id, {
        adminReply: text,
        resolution: resolutions[note.id] || undefined,
        overwrite,
      });
      setDrafts((d) => ({ ...d, [note.id]: '' }));
      setConfirmOverwrite(null);
      load(unansweredOnly, page);
    } catch (err) {
      if (err instanceof ApiError && err.body?.code === 'NOTE_ALREADY_REPLIED') {
        setConfirmOverwrite(note);
      } else {
        setError(describeError(err, t('replyFailed'), translateApiError));
      }
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
          onCheckedChange={(checked) => toggleUnanswered(checked === true)}
          data-testid="unanswered-only"
        />
        {t('unansweredOnly')}
      </Label>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm wrap-anywhere">
                      {tk(n.kind.toLowerCase() as 'nudge' | 'complaint' | 'note')}{' '}
                      <span className="font-normal text-muted-foreground">
                        {t('from')} {n.user?.email ?? '—'}
                      </span>
                    </strong>
                    {n.dueAt && (
                      <Badge
                        variant="outline"
                        className={n.overdue ? 'border-destructive text-destructive' : undefined}
                        data-testid="due-badge"
                      >
                        {n.overdue
                          ? t('overdue')
                          : t('dueAt', { date: formatWarsawDate(n.dueAt, locale) })}
                      </Badge>
                    )}
                    {n.resolution && (
                      <Badge variant="outline" className="uppercase">
                        {t(`resolutions.${n.resolution}`)}
                      </Badge>
                    )}
                  </div>
                  <p className="wrap-anywhere">{n.body}</p>

                  {n.adminReply ? (
                    <Reply label={t('answered')} text={n.adminReply} />
                  ) : (
                    <div className="mt-2 flex flex-col gap-2">
                      <Textarea
                        value={drafts[n.id] ?? ''}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [n.id]: e.target.value }))
                        }
                        placeholder={t('replyPlaceholder')}
                        aria-label={t('replyPlaceholder')}
                        rows={2}
                        maxLength={2000}
                      />
                      <div className="flex flex-wrap items-center gap-2 sm:flex-row">
                        {n.kind === 'COMPLAINT' && (
                          <Select
                            value={resolutions[n.id] ?? ''}
                            onValueChange={(value) =>
                              setResolutions((r) => ({
                                ...r,
                                [n.id]: value as ComplaintResolution,
                              }))
                            }
                          >
                            <SelectTrigger className="w-44" data-testid="resolution-select">
                              <SelectValue placeholder={t('resolutionPlaceholder')} />
                            </SelectTrigger>
                            <SelectContent>
                              {RESOLUTIONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {t(`resolutions.${r}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          type="button"
                          size="lg"
                          onClick={() => void send(n)}
                          disabled={busy === n.id || !(drafts[n.id] ?? '').trim()}
                          data-testid="send-reply"
                        >
                          {t('sendReply')}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <PaginationBar
        page={page}
        limit={LIMIT}
        total={total}
        count={notes?.length ?? 0}
        onPageChange={setPage}
      />

      <AlertDialog
        open={confirmOverwrite !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmOverwrite(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('overwriteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('overwriteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('overwriteCancel')}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-overwrite"
              onClick={() => {
                if (confirmOverwrite) void send(confirmOverwrite, true);
              }}
            >
              {t('overwriteYes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
