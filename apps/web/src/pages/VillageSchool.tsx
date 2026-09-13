import { useParams } from 'react-router-dom';
import type { VillageSchoolPage } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import { useApi } from '../lib/useApi.js';
import { CATEGORY_LABELS, NEED_KIND_LABELS, SCHEME_LABELS } from '../lib/labels.js';
import { Card, ErrorNotice, PageHeading, Spinner, Stat } from '../components/ui.js';
import { TopBar } from '../components/Shell.js';

/**
 * The page behind the QR code on the school wall.
 *
 * No account, and that is the whole design. A parent will not register to look
 * at their child's school, and asking them to is the difference between a
 * noticeboard the village reads and one nobody has ever opened. It is also the
 * safest surface in the product: no login, no personal data, nothing that has
 * not already been cleared by a block officer.
 *
 * Who it is for, in the order they matter. A parent, who currently has no way
 * of knowing what the school does. The gram pradhan, who controls village funds
 * and convening power and has never been shown a reason to spend either here.
 * The School Management Committee — three-quarters parents by law — whose
 * authority is real and whose information is nil. And the retired master, the
 * alumnus and the local volunteer, any of whom would help if somebody told them
 * what was needed.
 */
export function VillageSchool() {
  const { udiseCode } = useParams<{ udiseCode: string }>();
  const { t, d, locale } = useI18n();
  const { data, error, loading, reload, offline } = useApi<VillageSchoolPage>(
    udiseCode ? `/v1/village/schools/${udiseCode}` : null,
    [udiseCode],
  );

  if (loading) return <Spinner />;
  if (error || !data) {
    return (
      <div className="app">
        <TopBar />
        <main className="main" id="main">
          <ErrorNotice
            message={offline ? t('error.offline') : t('village.notFound')}
            onRetry={reload}
          />
        </main>
      </div>
    );
  }

  const stillOut = data.outOfSchool.stillOut;

  return (
    <div className="app">
      <TopBar />
      <main className="main" id="main">
        <PageHeading
          title={data.schoolName}
          subtitle={[data.villageOrWard, data.blockName, data.districtName]
            .filter(Boolean)
            .join(' · ')}
        />
        <p className="faint" style={{ marginTop: '-0.5rem' }}>
          UDISE {data.udiseCode}
        </p>

        {/* What the village can do, first — above everything, including the
            school's own numbers.
            A randomised trial run in Jaunpur in this very state tested almost
            exactly this page's theory of change: informing a community about
            its village education committee, and publishing report cards,
            reportedly moved nothing — not participation, not teacher effort,
            not learning. What moved learning was the arm that gave volunteers
            a concrete task to do. If that holds, a page that only informs is a
            page that does nothing, and the only part of it that earns its place
            is the part a reader can act on before they close the tab.
            NOTE: the citation is from research run for this repo and could not
            be retrieved directly — see docs/evidence.md. The ordering is
            defensible without it, but the claim should not be repeated as
            established until somebody reads the paper. */}
        {data.openNeeds.length > 0 ? (
          <Card>
            <h2>{t('village.needs')}</h2>
            <p className="muted">{t('village.needsHint')}</p>
            <div className="stack">
              {data.openNeeds.map((need) => (
                <div className="need" key={need.id}>
                  <div className="row">
                    <span className="tag tag--ochre">{NEED_KIND_LABELS[locale][need.kind]}</span>
                    {need.status === 'PROMISED' ? (
                      <span className="tag tag--green">{t('village.promised')}</span>
                    ) : null}
                    {need.quantity !== null ? (
                      <span className="tag">
                        {t('village.quantity')}: {need.quantity}
                      </span>
                    ) : null}
                  </div>
                  <p style={{ fontWeight: 600, margin: '0.4rem 0 0.2rem' }}>{need.title}</p>
                  {need.detail ? (
                    <p className="muted" style={{ margin: 0 }}>
                      {need.detail}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="faint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              {t('village.howToHelp')}
            </p>
          </Card>
        ) : null}

        {data.recentlyMet.length > 0 ? (
          <Card>
            <h2>{t('village.thanks')}</h2>
            <ul style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
              {data.recentlyMet.map((need) => (
                <li key={need.id}>
                  {need.title}
                  {need.helperCredit ? (
                    <>
                      {' — '}
                      <strong>{need.helperCredit}</strong>
                    </>
                  ) : null}
                  {need.metOn ? <span className="faint"> · {d(need.metOn)}</span> : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {data.recentWork.length > 0 ? (
          <Card>
            <h2>{t('village.work')}</h2>
            <p className="muted">{t('village.workHint')}</p>
            <div className="stack">
              {data.recentWork.map((item) => (
                <div className="need" key={item.id}>
                  <p style={{ fontWeight: 600, margin: 0 }}>{item.title}</p>
                  <div className="row" style={{ marginTop: '0.35rem' }}>
                    <span className="faint">{d(item.occurredOn)}</span>
                    <span className="tag">
                      {CATEGORY_LABELS[locale][
                        item.category as keyof (typeof CATEGORY_LABELS)['hi']
                      ] ?? item.category}
                    </span>
                    {item.schemes
                      .filter((scheme) => scheme !== 'NONE')
                      .map((scheme) => (
                        <span className="tag tag--info" key={scheme}>
                          {SCHEME_LABELS[locale][scheme as keyof (typeof SCHEME_LABELS)['hi']] ??
                            scheme}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {/* The committee the Right to Education Act already gives these parents,
            and which almost nowhere can they see the workings of. */}
        {data.lastSmcMeeting ? (
          <Card>
            <h2>{t('village.smc')}</h2>
            <p className="faint">
              {t('village.smcHeldOn')}: {d(data.lastSmcMeeting.heldOn)} ·{' '}
              {data.lastSmcMeeting.membersPresent} {t('village.present')} (
              {data.lastSmcMeeting.parentsPresent} {t('village.parents')},{' '}
              {data.lastSmcMeeting.womenPresent} {t('village.women')})
            </p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{data.lastSmcMeeting.decisions}</p>
            {data.lastSmcMeeting.raisedWithBlock ? (
              <div className="notice notice--warn">
                <strong>{t('village.raised')}</strong>
                <p style={{ margin: '0.4rem 0 0' }}>{data.lastSmcMeeting.raisedWithBlock}</p>
              </div>
            ) : null}
          </Card>
        ) : null}

        {data.outOfSchool.habitationsSurveyed > 0 ? (
          <Card>
            <h2>{t('village.outOfSchool')}</h2>
            <div className="row" style={{ gap: '1.5rem' }}>
              <Stat value={String(data.outOfSchool.childrenFound)} label={t('village.found')} />
              <Stat
                value={String(data.outOfSchool.childrenEnrolled)}
                label={t('village.broughtBack')}
              />
              <Stat value={String(stillOut)} label={t('village.stillOut')} />
            </div>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              {stillOut > 0 ? t('village.stillOutHint') : t('village.allBack')}
            </p>
            <p className="faint" style={{ marginBottom: 0 }}>
              {t('village.surveyPrivacy')}
            </p>
          </Card>
        ) : null}

        {/* The register, deliberately not the headline.
            Two findings pull in opposite directions here and this is the
            synthesis. After the June 2025 school-pairing order, a public
            headcount on a school page is read by teachers as evidence for
            closing their school and abolishing their post — which would make
            them suppress activity at exactly the small schools that most need
            visibility. But a dated figure the school itself controls is also
            the thing that makes a wrong merger list contestable, and the
            High Court found schools above the threshold on that list.
            So: kept, dated, attributed to the school's own register, and
            placed where a number belongs rather than where a verdict does. */}
        <Card>
          <h2>{t('village.register')}</h2>
          <p style={{ margin: '0 0 0.3rem' }}>
            {t('village.childrenOnRegister')}: <strong>{data.enrolment.total}</strong>
            {data.enrolment.asOn ? (
              <span className="faint">
                {' '}
                · {t('enrolment.asOn')} {d(data.enrolment.asOn)}
              </span>
            ) : null}
          </p>
          <p className="faint" style={{ marginBottom: '0.5rem' }}>
            {t('village.privacy')}
          </p>
          {/* The department's own record for the same school. Linked rather
              than restated: duplicating UDISE+ would put this platform in the
              position of contradicting the official figure. */}
          <p className="faint" style={{ marginBottom: 0 }}>
            {t('village.officialRecord')}{' '}
            <a href="https://kys.udiseplus.gov.in/" target="_blank" rel="noreferrer noopener">
              kys.udiseplus.gov.in
            </a>{' '}
            · UDISE {data.udiseCode}
          </p>
        </Card>

        <Card>
          <h2>{t('village.somethingWrong')}</h2>
          <p className="muted">{t('village.grievance')}</p>
        </Card>
      </main>
    </div>
  );
}
