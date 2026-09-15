'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/**
 * Previous/Next + "x–y z N" for the paginated admin lists (gap G21) — customers,
 * notes, consultations. `total` is the true count from `X-Total-Count`; `count`
 * is how many rows are on THIS page (the last page may be short).
 */
export function PaginationBar({
  page,
  limit,
  total,
  count,
  onPageChange,
}: {
  page: number;
  limit: number;
  total: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('common.pagination');

  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = from + count - 1;
  const hasPrev = page > 1;
  const hasNext = to < total;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-sm text-muted-foreground" data-testid="pagination-summary">
        {t('range', { from, to, total })}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(page - 1)}
          data-testid="pagination-prev"
        >
          {t('previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
          data-testid="pagination-next"
        >
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
