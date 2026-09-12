import { useState } from 'react';
import type { District, Leaderboard, OverviewReport } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { useApi } from '../lib/useApi.js';
import { CATEGORY_LABELS } from '../lib/labels.js';
import { Card, ErrorNotice, Field, PageHeading, RateBar, Spinner, Stat } from '../components/ui.js';
import { tokenStore } from '../api/client.js';

/**
 * The departmental view.
 *
 * Built around one argument: the numbers here are only worth anything if they
 * are the numbers of moderated work measured against the full register of
 * schools. So the screen leads with participation — what proportion of schools
 * in this area published anything — rather than with a raw activity count,
 * which any single enthusiastic block could inflate.
 *
 * The dormant-schools list sits next to the leaderboard on purpose: the useful
 * question for a district officer is not "who is winning" but "who needs a
 * visit".
 */
export function Reports() {
  const { t, n, d } = useI18n();
  const { user } = useAuth();
  const [districtId, setDistrictId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const canPickDistrict = user?.role === 'SUPER_ADMIN' || user?.role === 'STATE_ADMIN';
  const districts = useApi<{ items: District[] }>(canPickDistrict ? '/v1/districts' : null);

  const params = new URLSearchParams();
  if (districtId) params.set('districtId', districtId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const overview = useApi<OverviewReport>(`/v1/reports/overview${suffix}`, [districtId, from, to]);
  const leaderboard = useApi<Leaderboard>(
    `/v1/reports/leaderboard${suffix ? `${suffix}&` : '?'}groupBy=${canPickDistrict && !districtId ? 'DISTRICT' : 'BLOCK'}&limit=25`,
    [districtId, from, to],
  );
  const dormant = useApi<{
    items: Array<{ id: string; name: string; blockName: string; lastActivityAt: string | null }>;
  }>(`/v1/reports/dormant-schools${suffix ? `${suffix}&` : '?'}limit=25`, [districtId, from, to]);

  return (
    <>
      <PageHeading title={t('nav.reports')} subtitle={overview.data?.scope.name} />

      <Card>
        <div className="row">
          {canPickDistrict ? (
            <Field label={t('report.schools')} htmlFor="districtFilter">
              <select
                id="districtFilter"
                value={districtId}
                onChange={(event) => setDistrictId(event.target.value)}
              >
                <option value="">Uttar Pradesh</option>
                {districts.data?.items.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.nameHi}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label={t('report.from')} htmlFor="fromDate">
            <input
              id="fromDate"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label={t('report.to')} htmlFor="toDate">
            <input
              id="toDate"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
        </div>
      </Card>

      {overview.loading ? <Spinner /> : null}
      {overview.error && !overview.loading ? (
        <ErrorNotice
          message={overview.offline ? t('error.offline') : t('error.generic')}
          onRetry={overview.reload}
        />
      ) : null}

      {overview.data ? (
        <>
          <Card>
            <h2>{t('report.overview')}</h2>
            <p className="faint">
              {overview.data.scope.from} — {overview.data.scope.to}
            </p>
            <div className="grid">
              <RateBar
                value={overview.data.participationRate.schools}
                label={t('report.participation')}
              />
              <Stat
                value={n(overview.data.totals.activeSchools)}
                label={t('report.activeSchools')}
              />
              <Stat value={n(overview.data.totals.schools)} label={t('report.schools')} />
              <Stat
                value={n(overview.data.totals.publishedActivities)}
                label={t('report.activities')}
              />
              <Stat
                value={n(overview.data.totals.verifiedAchievements)}
                label={t('report.achievements')}
              />
              <Stat value={n(overview.data.totals.teachers)} label={t('report.teachers')} />
              <Stat value={n(overview.data.totals.students)} label={t('report.students')} />
            </div>
          </Card>

          {overview.data.byCategory.length > 0 ? (
            <Card>
              <h2>{t('activity.category')}</h2>
              <CategoryBars data={overview.data.byCategory} />
            </Card>
          ) : null}
        </>
      ) : null}

      {leaderboard.data && leaderboard.data.rows.length > 0 ? (
        <Card>
          <div className="card__title">
            <h2 style={{ margin: 0 }}>{leaderboard.data.groupBy}</h2>
            <ExportButton
              href={`/v1/reports/leaderboard.csv${suffix ? `${suffix}&` : '?'}groupBy=${leaderboard.data.groupBy}`}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('report.schools')}</th>
                  <th scope="col" className="num">
                    {t('report.activeSchools')}
                  </th>
                  <th scope="col" className="num">
                    {t('report.activities')}
                  </th>
                  <th scope="col" className="num">
                    {t('report.achievements')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.data.rows.map((row) => (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      style={{
                        background: 'transparent',
                        textTransform: 'none',
                        fontSize: '0.9rem',
                      }}
                    >
                      {row.name}
                      {row.parentName ? <span className="faint"> · {row.parentName}</span> : null}
                    </th>
                    <td className="num">
                      {row.activeSchools !== null && row.schools !== null
                        ? `${n(row.activeSchools)} / ${n(row.schools)}`
                        : '—'}
                    </td>
                    <td className="num">{n(row.publishedActivities)}</td>
                    <td className="num">{n(row.verifiedAchievements)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {dormant.data && dormant.data.items.length > 0 ? (
        <Card>
          <h2>{t('report.dormant')}</h2>
          <p className="muted">{t('report.dormantHint')}</p>
          <ul style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
            {dormant.data.items.map((school) => (
              <li key={school.id}>
                {school.name} <span className="faint">· {school.blockName}</span>
                {school.lastActivityAt ? (
                  <span className="faint"> · {d(school.lastActivityAt)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function CategoryBars({ data }: { data: OverviewReport['byCategory'] }) {
  const { locale, n } = useI18n();
  const max = Math.max(...data.map((row) => row.count), 1);
  return (
    <div className="stack">
      {data.map((row) => (
        <div key={row.category}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem' }}>{CATEGORY_LABELS[locale][row.category]}</span>
            <span className="faint" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {n(row.count)}
            </span>
          </div>
          <div className="bar">
            <div className="bar__fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Downloads the CSV.
 *
 * A plain link cannot carry the bearer token, so the file is fetched with the
 * header and handed to the browser as a blob. The alternative — a token in the
 * query string — would put a credential in the browser history, in the proxy
 * logs, and in any referrer.
 */
function ExportButton({ href }: { href: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const response = await fetch(href, {
        headers: { authorization: `Bearer ${tokenStore.access ?? ''}` },
      });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `balsanskar-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn--ghost btn--small"
      disabled={busy}
      onClick={() => void download()}
    >
      {t('action.export')}
    </button>
  );
}
