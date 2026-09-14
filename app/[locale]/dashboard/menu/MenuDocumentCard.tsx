'use client';

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  CloudUploadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { DOCUMENT_ACCEPT, MAX_UPLOAD_BYTES, type MenuDocument } from '@/lib/api/menu';
import { cn } from '@/lib/cn';
import { useDeleteMenuDocument, useUploadMenuDocument } from '@/lib/hooks/use-menu';

import { describeError } from './menu-shared';

const ACCEPTED_TYPES = DOCUMENT_ACCEPT.split(',');

/**
 * The printed menu: one current PDF or image. Empty, it is a drop zone; filled,
 * it shows the file with Replace and Remove. Uploading always replaces — the
 * backend keeps one document and never reuses a storage key.
 */
export function MenuDocumentCard({
  document,
  loading,
  loadError,
}: {
  document: MenuDocument | null;
  loading: boolean;
  loadError: string | null;
}) {
  const t = useTranslations('menuPage.document');
  const tErrors = useTranslations('menuPage.errors');
  const locale = useLocale();
  const translateApiError = useApiErrorTranslate();

  const upload = useUploadMenuDocument();
  const remove = useDeleteMenuDocument();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function send(file: File) {
    setError(null);
    // The browser reports HEIC as '' on some systems; let the backend judge those.
    if (file.type !== '' && !ACCEPTED_TYPES.includes(file.type)) {
      setError(tErrors('documentType'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(tErrors('fileTooLarge'));
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast.success(document ? t('replaced') : t('uploaded'));
    } catch (caught) {
      setError(describeError(caught, tErrors('uploadFailed'), translateApiError));
    }
  }

  function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void send(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void send(file);
  }

  async function doRemove() {
    setError(null);
    try {
      await remove.mutateAsync();
      toast.success(t('removed'));
    } catch (caught) {
      setError(describeError(caught, tErrors('removeFailed'), translateApiError));
    }
  }

  const busy = upload.isPending || remove.isPending;
  const updated = document
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        // Warsaw time, whatever zone the admin's laptop or the server is in.
        timeZone: 'Europe/Warsaw',
      }).format(new Date(document.updatedAt))
    : null;

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!busy) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (busy) {
        event.preventDefault();
        return;
      }
      onDrop(event);
    },
  };

  return (
    <Card data-testid="menu-document">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
        {document ? (
          <CardAction>
            <Badge variant="secondary" data-testid="document-kind">
              {document.kind === 'PDF' ? <FileTextIcon /> : <ImageIcon />}
              {t(`kind.${document.kind}`)}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex gap-4">
            <Skeleton className="aspect-3/4 w-24 shrink-0 rounded-lg bg-accent sm:w-36" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-4 w-2/3 bg-accent" />
              <Skeleton className="h-4 w-1/3 bg-accent" />
              <Skeleton className="mt-auto h-8 w-40 bg-accent" />
            </div>
          </div>
        ) : document ? (
          <div
            className={cn(
              'flex gap-4 rounded-lg transition-shadow',
              dragging && 'ring-2 ring-highlight ring-offset-4 ring-offset-card',
            )}
            {...dropHandlers}
          >
            <a
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="group relative block w-24 shrink-0 self-start overflow-hidden rounded-lg bg-secondary ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-36"
              aria-label={t('open')}
              data-testid="document-preview"
            >
              {document.previewUrl || document.kind === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={document.previewUrl ?? document.url}
                  alt=""
                  className="aspect-3/4 w-full max-w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex aspect-3/4 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <FileTextIcon className="size-8 sm:size-10" aria-hidden />
                  <span className="text-xs font-semibold tracking-widest">PDF</span>
                </div>
              )}
              {busy ? (
                <span className="absolute inset-0 flex items-center justify-center bg-card/70">
                  <Loader2Icon className="size-6 animate-spin text-foreground" aria-hidden />
                </span>
              ) : null}
            </a>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">
                  {document.kind === 'PDF' ? t('currentPdf') : t('currentImage')}
                </p>
                <p className="text-sm text-muted-foreground">{t('updated', { date: updated! })}</p>
                <p className="text-sm text-muted-foreground">{t('dropToReplace')}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={document.url} target="_blank" rel="noreferrer">
                    <ExternalLinkIcon />
                    {t('open')}
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={() => fileInput.current?.click()}
                  disabled={busy}
                  data-testid="document-replace"
                >
                  {upload.isPending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                  {upload.isPending ? t('uploading') : t('replace')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmRemove(true)}
                  disabled={busy}
                  data-testid="document-remove"
                >
                  <Trash2Icon />
                  {t('remove')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
              dragging ? 'border-highlight bg-highlight-soft/30' : 'border-input bg-secondary/50',
            )}
            data-testid="document-dropzone"
            {...dropHandlers}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10">
              {upload.isPending ? (
                <Loader2Icon className="size-5 animate-spin" aria-hidden />
              ) : (
                <CloudUploadIcon className="size-5" aria-hidden />
              )}
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">
                {upload.isPending ? t('uploading') : dragging ? t('dropNow') : t('emptyTitle')}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">{t('emptyHint')}</p>
            </div>
            <Button
              size="sm"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              data-testid="document-choose"
            >
              {t('choose')}
            </Button>
          </div>
        )}

        <Input
          ref={fileInput}
          type="file"
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={onChoose}
          data-testid="document-input"
        />

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription className="whitespace-pre-line">{loadError}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" data-testid="document-error">
            <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('removeBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void doRemove()}
              data-testid="document-remove-confirm"
            >
              {t('remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
