import { SAMPLE_RATE, type SchoolTrust } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import { useApi } from '../lib/useApi.js';
import { Card } from './ui.js';

/**
 * A school's standing, shown next to its work rather than on a page of its own.
 *
 * Deliberately framed as a record of what has happened — cleared, sent back —
 * and not as a score. A tier is the reason this school's work is reviewed as
 * often as it is, which is a fact an officer can explain to a head teacher.
 */
export function TrustCard({ schoolId }: { schoolId: string }) {
  const { t, d } = useI18n();
  const { data } = useApi<SchoolTrust>(`/v1/schools/${schoolId}/trust`, [schoolId]);
  if (!data) return null;

  return (
    <Card>
      <div className="card__title">
        <h2 style={{ margin: 0 }}>{t('trust.title')}</h2>
        <span className={data.tier === 'WATCH' ? 'tag tag--danger' : 'tag tag--green'}>
          {t(`tier.${data.tier}`)}
        </span>
      </div>
      <dl className="keyvals">
        <dt>{t('trust.cleared')}</dt>
        <dd>{data.clearedCount}</dd>
        <dt>{t('trust.returned')}</dt>
        <dd>
          {data.returnedCount}
          {data.lastReturnedAt ? ` · ${d(data.lastReturnedAt)}` : ''}
        </dd>
        <dt>{t('trust.sample')}</dt>
        <dd>{Math.round((data.sampleRate ?? SAMPLE_RATE[data.tier]) * 100)}%</dd>
      </dl>
    </Card>
  );
}
