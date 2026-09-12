import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, type ActivitySummary } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { CATEGORY_LABELS } from '../lib/labels.js';
import { Card, EmptyState, ErrorNotice, PageHeading, Spinner } from '../components/ui.js';
import { ActivityRow } from './Home.js';

/**
 * The activity list.
 *
 * Filters are kept to the two a person actually reaches for — status and
 * category — because every extra control is another thing to mis-tap on a small
 * screen. Anything more specific belongs in the reporting screens, where the
 * user is at a desk.
 */
export function Activities() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const query = new URLSearchParams({ limit: '20' });
  if (status) query.set('status', status);
  if (category) query.set('category', category);

  const { data, error, loading, reload, offline } = useApi<PagedResponse<ActivitySummary>>(
    `/v1/activities?${query.toString()}`,
    [status, category],
  );

  const isSchoolStaff = user?.role === 'TEACHER' || user?.role === 'PRINCIPAL';

  return (
    <>
      <PageHeading
        title={t('nav.activities')}
        action={
          isSchoolStaff ? (
            <Link to="/app/activities/new" className="btn btn--primary btn--small">
              + {t('action.newActivity')}
            </Link>
          ) : undefined
        }
      />

      <Card>
        <div className="row">
          <label className="visually-hidden" htmlFor="statusFilter">
            {t('nav.activities')}
          </label>
          <select
            id="statusFilter"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            style={{ flex: '1 1 10rem' }}
          >
            <option value="">{t('nav.activities')}</option>
            {ACTIVITY_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
          <label className="visually-hidden" htmlFor="categoryFilter">
            {t('activity.category')}
          </label>
          <select
            id="categoryFilter"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            style={{ flex: '1 1 10rem' }}
          >
            <option value="">{t('activity.category')}</option>
            {ACTIVITY_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[locale][value]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? <Spinner /> : null}
      {error && !loading ? (
        <ErrorNotice message={offline ? t('error.offline') : t('error.generic')} onRetry={reload} />
      ) : null}
      {data && data.items.length === 0 && !loading ? (
        <EmptyState
          icon="📋"
          title={t('activity.empty')}
          hint={isSchoolStaff ? t('activity.emptyHint') : undefined}
        />
      ) : null}

      <div className="stack" style={{ marginTop: '0.75rem' }}>
        {data?.items.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))}
      </div>
    </>
  );
}

/**
 * The moderation queue.
 *
 * A separate route from the list so that it can be linked to directly from the
 * home screen and from a notification, and so a head teacher opening "review"
 * never has to remember to set a filter.
 */
export function ReviewQueue() {
  const { t } = useI18n();
  const { data, error, loading, reload, offline } = useApi<PagedResponse<ActivitySummary>>(
    '/v1/activities?status=PENDING_REVIEW&limit=50',
  );

  return (
    <>
      <PageHeading title={t('review.title')} />
      {loading ? <Spinner /> : null}
      {error && !loading ? (
        <ErrorNotice message={offline ? t('error.offline') : t('error.generic')} onRetry={reload} />
      ) : null}
      {data && data.items.length === 0 && !loading ? (
        <EmptyState icon="✅" title={t('review.empty')} />
      ) : null}
      <div className="stack">
        {data?.items.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} />
        ))}
      </div>
    </>
  );
}
