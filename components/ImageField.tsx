'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import { ImageUpIcon, Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
import { ApiError, formatApiError } from '@/lib/api/client';
import { useApiErrorTranslate } from '@/lib/api/use-api-error';
import { cn } from '@/lib/cn';
import { checkImageFile, cropToBlob, IMAGE_FIELD_ACCEPT } from '@/lib/image-crop';

export interface ImageFieldProps {
  /** The current image's URL (not a storage key), or nothing yet. */
  value?: string | null;
  /** Fixed crop proportions, e.g. 4 / 3. Omit for a free crop. */
  aspect?: number;
  /**
   * Receives the cropped image. Throw to report a failure — an ApiError is
   * worded through formatApiError, anything else as a generic upload failure.
   */
  onUpload: (file: Blob) => Promise<void>;
  disabled?: boolean;
  label: string;
  /** Optional line under the formats hint. */
  hint?: string;
  className?: string;
}

/**
 * One image input for the whole dashboard: drop or choose a file, crop it,
 * hand the crop to the caller. Ported from minirue's ImageCropModal and the
 * gallery drop zone, rebuilt on shadcn and next-intl.
 */
export function ImageField({
  value,
  aspect,
  onUpload,
  disabled = false,
  label,
  hint,
  className,
}: ImageFieldProps) {
  const t = useTranslations('imageField');
  const translateApiError = useApiErrorTranslate();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const pendingUrl = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    },
    [],
  );

  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<CropSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = disabled || uploading;

  function take(file: File | undefined) {
    if (!file || locked) return;
    const problem = checkImageFile(file);
    if (problem) {
      setError(t(`errors.${problem}`));
      return;
    }
    setError(null);
    discard();
    const source = { file, url: URL.createObjectURL(file) };
    pendingUrl.current = source.url;
    setPending(source);
  }

  /** Revokes the object URL of the file being cropped, if any, and closes the crop. */
  function discard() {
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    pendingUrl.current = null;
    setPending(null);
  }

  async function upload(blob: Blob) {
    discard();
    setUploading(true);
    setError(null);
    try {
      await onUpload(blob);
    } catch (caught) {
      const worded =
        caught instanceof ApiError ? formatApiError(caught.body, translateApiError) : '';
      setError(worded || t('errors.uploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (!locked) setDragging(true);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    take(event.dataTransfer.files[0]);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.current?.click();
    }
  }

  return (
    <div className={cn('grid min-w-0 gap-2', className)} data-testid="image-field">
      <span id={`${inputId}-label`} className="text-sm leading-none font-medium">
        {label}
      </span>

      <div
        role="button"
        tabIndex={locked ? -1 : 0}
        aria-labelledby={`${inputId}-label`}
        aria-describedby={`${inputId}-hint`}
        aria-disabled={locked || undefined}
        aria-busy={uploading || undefined}
        data-dragging={dragging || undefined}
        data-testid="image-field-dropzone"
        onClick={() => !locked && input.current?.click()}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex w-full max-w-80 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-secondary transition-colors outline-none',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'data-dragging:border-primary data-dragging:bg-accent',
          locked && 'cursor-not-allowed opacity-70',
        )}
        style={{ aspectRatio: aspect ?? 4 / 3 }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="pointer-events-none absolute inset-0 size-full object-cover"
            data-testid="image-field-preview"
          />
        ) : null}

        {/* Over a current picture the prompt only appears while it has
            something to say (a drag, an upload); screen readers always get it. */}
        <div
          className={
            value && !dragging && !uploading
              ? 'sr-only'
              : cn(
                  'pointer-events-none relative flex flex-col items-center gap-1.5 p-4 text-center text-xs text-muted-foreground',
                  value && 'm-2 rounded-md bg-background/85 text-foreground',
                )
          }
        >
          {uploading ? (
            <>
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span role="status">{t('uploading')}</span>
            </>
          ) : (
            <>
              <ImageUpIcon className="size-5" aria-hidden />
              <span>{dragging ? t('dropNow') : value ? t('replaceHint') : t('dropHint')}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={locked}
          onClick={() => input.current?.click()}
          data-testid="image-field-choose"
        >
          {value ? t('replace') : t('choose')}
        </Button>
        <span id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {t('formats')}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <Input
        ref={input}
        type="file"
        accept={IMAGE_FIELD_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        disabled={locked}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Clear first, so choosing the same file again still fires a change.
          event.target.value = '';
          take(file);
        }}
        data-testid="image-field-input"
      />

      {error && (
        <Alert variant="destructive" data-testid="image-field-error">
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {pending && (
        <CropDialog
          key={pending.url}
          source={pending}
          aspect={aspect}
          onCancel={discard}
          onCropped={(blob) => void upload(blob)}
        />
      )}
    </div>
  );
}

function initialCrop(width: number, height: number, aspect?: number): PercentCrop {
  if (aspect) {
    return centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, width, height), width, height);
  }
  return centerCrop({ unit: '%', width: 90, height: 90 }, width, height);
}

interface CropSource {
  file: File;
  /** A same-origin object URL, so the canvas it is drawn to is never tainted. */
  url: string;
}

/** Mounted only while a file waits to be cropped, keyed by it: state starts clean. */
function CropDialog({
  source,
  aspect,
  onCancel,
  onCropped,
}: {
  source: CropSource;
  aspect?: number;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const t = useTranslations('imageField');
  const [crop, setCrop] = useState<PercentCrop>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);

  function onLoad(event: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = event.currentTarget;
    setCrop(initialCrop(width, height, aspect));
  }

  async function apply() {
    const img = image.current;
    if (!img || !crop || crop.width === 0 || crop.height === 0) {
      setError(t('errors.noCrop'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onCropped(await cropToBlob(img, crop, source.file.type, aspect));
    } catch {
      setError(t('errors.cropFailed'));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="sm:max-w-xl" data-testid="image-field-crop">
        <DialogHeader>
          <DialogTitle>{t('crop.title')}</DialogTitle>
          <DialogDescription>
            {aspect ? t('crop.descriptionFixed') : t('crop.descriptionFree')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] justify-center overflow-auto rounded-lg bg-secondary p-2">
          <ReactCrop
            crop={crop}
            onChange={(_pixel, percent) => setCrop(percent)}
            aspect={aspect}
            keepSelection
            ruleOfThirds
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={image}
              src={source.url}
              alt={t('crop.alt')}
              onLoad={onLoad}
              onError={() => setError(t('errors.unreadable'))}
              className="block max-h-[56vh]"
            />
          </ReactCrop>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {t('crop.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void apply()}
            disabled={busy}
            data-testid="image-field-crop-confirm"
          >
            {busy ? t('crop.cropping') : t('crop.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
