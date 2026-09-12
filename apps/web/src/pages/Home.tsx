import { Link } from 'react-router-dom';
import type { ActivitySummary, OverviewReport } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeading,
  RateBar,
  Spinner,
  Stat,
  StatusTag,
} from '../components/ui.js';

/**
 * The first screen after signing in.
 *
 * What it shows depends entirely on the job: a teacher opens the app to record
 * something, so the primary action is a large "new activity" button and their
 * own recent work. An officer opens it to find out what is happening, so they
 * get the numbers for their area and the queue waiting on them.
 */
export function Home() {
  const { t, n } = useI18n();
  const { user, may } = useAuth();

  const isSchoolStaff = user?.role === 'TEACHER' || user?.role === 'PRINCIPAL';
  const overview = useApi<OverviewReport>(
    may('report:read') && !isSchoolStaff ? '/v1/reports/overview' : null,
  );
  const mine = useApi<PagedResponse<ActivitySummary>>(
    user ? `/v1/activities?limit=5${user.role === 'TEACHER' ? `&authorId=${user.id}` : ''}` : null,
  );
  const review = useApi<PagedResponse<ActivitySummary>>(
    may('activity:moderate') ? '/v1/activities?status=PENDING_REVIEW&limit=1' : null,
  );

  return (
    <>
      <PageHeading
        title={greeting(user?.fullName ?? '')}
        subtitle={[user?.schoolName, user?.blockName, user?.districtName]
          .filter(Boolean)
          .join(' · ')}
      />

      {user?.mustSetPassword ? (
        <div className="notice notice--warn" style={{ marginBottom: '1rem' }}>
          {t('account.mustSetPassword')}
        </div>
      ) : null}

      {isSchoolStaff ? (
        <Link
          to="/app/activities/new"
          className="btn btn--primary btn--block"
          style={{ marginBottom: '1rem' }}
        >
          ✏️ {t('action.newActivity')}
        </Link>
      ) : null}

      {review.data && review.data.items.length > 0 ? (
        <Link
          to="/app/review"
          className="notice notice--warn"
          style={{ display: 'block', marginBottom: '1rem' }}
        >
          {t('review.title')} →
        </Link>
      ) : null}

      {overview.loading ? <Spinner /> : null}
      {overview.data ? (
        <Card>
          <h2>{t('report.overview')}</h2>
          <p className="faint">
            {overview.data.scope.name} · {overview.data.scope.from} — {overview.data.scope.to}
          </p>
          <div className="grid">
            <Stat
              value={n(overview.data.totals.publishedActivities)}
              label={t('report.activities')}
            />
            <Stat
              value={n(overview.data.totals.verifiedAchievements)}
              label={t('report.achievements')}
            />
            <Stat value={n(overview.data.totals.activeSchools)} label={t('report.activeSchools')} />
            <RateBar
              value={overview.data.participationRate.schools}
              label={t('report.participation')}
            />
          </div>
          <p style={{ marginTop: '1rem', marginBottom: 0 }}>
            <Link to="/app/reports">{t('nav.reports')} →</Link>
          </p>
        </Card>
      ) : null}

      <Card>
        <h2>{t('nav.activities')}</h2>
        {mine.loading ? <Spinner /> : null}
        {mine.error && !mine.loading ? (
          <ErrorNotice
            message={mine.offline ? t('error.offline') : t('error.generic')}
            onRetry={mine.reload}
          />
        ) : null}
        {mine.data && mine.data.items.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t('activity.empty')}
            hint={isSchoolStaff ? t('activity.emptyHint') : undefined}
          />
        ) : null}
        <div className="stack">
          {mine.data?.items.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </div>
        {mine.data && mine.data.items.length > 0 ? (
          <p style={{ marginTop: '1rem', marginBottom: 0 }}>
            <Link to="/app/activities">{t('action.loadMore')} →</Link>
          </p>
        ) : null}
      </Card>
    </>
  );
}

export function ActivityRow({ activity }: { activity: ActivitySummary }) {
  const { d } = useI18n();
  return (
    <Link
      to={`/app/activities/${activity.id}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div className="card" style={{ boxShadow: 'none' }}>
        <div className="card__title">
          <div>
            <h3 style={{ margin: 0 }}>{activity.title}</h3>
            <p className="faint" style={{ margin: 0 }}>
              {d(activity.occurredOn)} · {activity.schoolName}
            </p>
          </div>
          <StatusTag status={activity.status} />
        </div>
        {activity.coverUrl ? (
          <img
            src={activity.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              maxHeight: '10rem',
              objectFit: 'cover',
              borderRadius: 'var(--radius)',
              marginTop: '0.5rem',
            }}
          />
        ) : null}
      </div>
    </Link>
  );
}

/**
 * A greeting keyed to the time of day, in a form a Hindi speaker would actually
 * use rather than a literal translation of "Good morning".
 */
function greeting(name: string): string {
  const hour = new Date().getHours();
  const salutation = hour < 12 ? 'सुप्रभात' : hour < 17 ? 'नमस्कार' : 'शुभ संध्या';
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  return firstName ? `${salutation}, ${firstName}` : salutation;
}
