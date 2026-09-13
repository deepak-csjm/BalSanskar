import { Link } from 'react-router-dom';
import type { PublicActivity } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { CATEGORY_LABELS, SCHEME_LABELS } from '../lib/labels.js';
import { Card, EmptyState, ErrorNotice, Spinner, Stat } from '../components/ui.js';
import { TopBar } from '../components/Shell.js';

/**
 * The public showcase.
 *
 * This is the page the department can put on a screen at a review meeting, and
 * the page a teacher can send to their block officer instead of a link to a
 * personal Instagram account. It is reachable without signing in, and it shows
 * only work a district-level officer approved for public view, with every named
 * child covered by a guardian's consent and shown by given name alone.
 *
 * Note what is absent: there is no like button, no share count, no follower
 * list, and no comment box. This is a record of public service, not a feed.
 */
export function Showcase() {
  const { t, n } = useI18n();
  const stats = useApi<{
    districts: number;
    participatingSchools: number;
    publishedActivities: number;
    verifiedAchievements: number;
  }>('/v1/public/statistics');
  const activities = useApi<PagedResponse<PublicActivity>>('/v1/public/activities?limit=20');

  return (
    <div className="app">
      <TopBar />
      <main className="main" id="main">
        <header className="page-head">
          <h1>{t('showcase.title')}</h1>
          <p className="muted">{t('showcase.subtitle')}</p>
        </header>

        {stats.data ? (
          <div className="grid" style={{ marginBottom: '1rem' }}>
            <Stat value={n(stats.data.participatingSchools)} label={t('report.schools')} />
            <Stat value={n(stats.data.publishedActivities)} label={t('report.activities')} />
            <Stat value={n(stats.data.verifiedAchievements)} label={t('report.achievements')} />
            <Stat value={n(stats.data.districts)} label={t('report.districts')} />
          </div>
        ) : null}

        {activities.loading ? <Spinner /> : null}
        {activities.error && !activities.loading ? (
          <ErrorNotice
            message={activities.offline ? t('error.offline') : t('error.generic')}
            onRetry={activities.reload}
          />
        ) : null}
        {activities.data && activities.data.items.length === 0 && !activities.loading ? (
          <EmptyState icon="🏫" title={t('showcase.empty')} />
        ) : null}

        <div className="stack">
          {activities.data?.items.map((activity) => (
            <ShowcaseCard key={activity.id} activity={activity} />
          ))}
        </div>

        <p className="muted" style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/signin">{t('action.signIn')}</Link>
        </p>
      </main>
    </div>
  );
}

function ShowcaseCard({ activity }: { activity: PublicActivity }) {
  const { d, locale, t } = useI18n();
  const cover = activity.media[0];

  return (
    <Card>
      {cover ? (
        <img
          src={cover.url}
          alt={cover.caption ?? activity.title}
          loading="lazy"
          decoding="async"
          width={cover.width ?? undefined}
          height={cover.height ?? undefined}
          style={{
            width: '100%',
            maxHeight: '16rem',
            objectFit: 'cover',
            borderRadius: 'var(--radius)',
            marginBottom: '0.75rem',
          }}
        />
      ) : null}
      <h2 style={{ marginBottom: '0.25rem' }}>{activity.title}</h2>
      <p className="faint" style={{ marginBottom: '0.5rem' }}>
        {activity.schoolName} · {activity.blockName} · {activity.districtName} ·{' '}
        {d(activity.occurredOn)}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{activity.description}</p>
      <div className="row">
        <span className="tag tag--green">{CATEGORY_LABELS[locale][activity.category]}</span>
        {activity.participantCount !== null ? (
          <span className="tag">
            {activity.participantCount} {t('activity.participantsShort')}
          </span>
        ) : null}
        {/* Programmes, where a child's given name used to sit. The work is what
            is being celebrated, and the school gets the credit for it. */}
        {activity.schemes
          .filter((scheme) => scheme !== 'NONE')
          .map((scheme) => (
            <span className="tag tag--ochre" key={scheme}>
              {SCHEME_LABELS[locale][scheme]}
            </span>
          ))}
      </div>
    </Card>
  );
}
