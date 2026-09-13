'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { ConsultationStatus } from '@/lib/api/consultations';

const VARIANT: Record<
  ConsultationStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  REQUESTED: 'secondary',
  CONFIRMED: 'default',
  COMPLETED: 'outline',
  CANCELLED: 'destructive',
};

export function ConsultationStatusBadge({ status }: { status: ConsultationStatus }) {
  const t = useTranslations('consultationsPage.statuses');
  return (
    <Badge variant={VARIANT[status]} data-status={status}>
      {t(status)}
    </Badge>
  );
}
