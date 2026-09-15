'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  apiGetAdminSummary,
  SUMMARY_KEYS,
  SUMMARY_LINKS,
  type AdminSummary,
} from '@/lib/api/admin-summary';
import { Link } from '@/lib/i18n/navigation';

/**
 * Counters for what needs attention right now (gap G22) — a new PENDING
 * order, an unanswered note, an overdue complaint. Each card links to the
 * page that fixes it. Silent on failure: this is a convenience overlay on
 * top of the readiness checklist, not something that should block the page.
 */
export function SummaryCounters() {
  const t = useTranslations('dashboard.summary');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGetAdminSummary()
      .then((data) => {
        if (alive) setSummary(data);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return null;

  if (!summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={t('loading')}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <ul
      className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4"
      data-testid="summary-counters"
    >
      {SUMMARY_KEYS.map((key) => (
        <li key={key}>
          <Link
            href={SUMMARY_LINKS[key]}
            className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            data-testid={`summary-${key}`}
          >
            <Card className="h-full transition-colors group-hover:border-highlight" size="sm">
              <CardContent className="flex flex-col gap-1">
                <span className="text-3xl font-semibold tabular-nums">{summary[key]}</span>
                <span className="text-xs tracking-wider text-muted-foreground uppercase">
                  {t(key)}
                </span>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
