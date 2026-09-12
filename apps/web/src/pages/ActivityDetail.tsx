import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  VISIBILITY_LEVELS,
  canApproveVisibility,
  type ActivityDetail as ActivityDetailType,
  type VisibilityLevel,
} from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { useApi } from '../lib/useApi.js';
import { BLOCKER_LABELS, CATEGORY_LABELS } from '../lib/labels.js';
import {
  Card,
  ErrorNotice,
  Field,
  PageHeading,
  Spinner,
  StatusTag,
  VisibilityTag,
} from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * One activity, and everything that can be done to it.
 *
 * The same screen serves the teacher who wrote it and the officer reviewing it;
 * which controls appear is decided by the record's state and the viewer's role,
 * exactly as the server would decide it. The publish checklist is rendered from
 * the server's own list of blockers rather than recomputed here, so the screen
 * can never claim something is publishable when the API will refuse it.
 */
export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, d, locale } = useI18n();
  const { user, may } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload, offline } = useApi<ActivityDetailType>(
    id ? `/v1/activities/${id}` : null,
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) {
    return (
      <ErrorNotice message={offline ? t('error.offline') : t('error.notFound')} onRetry={reload} />
    );
  }

  const isAuthor = data.authorId === user?.id;
  const canSubmit = isAuthor && (data.status === 'DRAFT' || data.status === 'REJECTED');
  const canModerate = may('activity:moderate') && data.status === 'PENDING_REVIEW' && !isAuthor;

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await work();
      reload();
    } catch (caught) {
      setActionError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeading
        title={data.title}
        subtitle={`${d(data.occurredOn)} · ${data.schoolName} · ${data.authorName}`}
        action={
          <div className="row">
            <StatusTag status={data.status} />
            {data.status === 'PUBLISHED' ? <VisibilityTag visibility={data.visibility} /> : null}
          </div>
        }
      />

      {data.status === 'REJECTED' && data.rejectionReason ? (
        <div className="notice notice--error" style={{ marginBottom: '1rem' }}>
          <strong>{t('action.reject')}:</strong> {data.rejectionReason}
        </div>
      ) : null}

      <Card>
        <p style={{ whiteSpace: 'pre-wrap' }}>{data.description}</p>
        {data.learningOutcome ? (
          <>
            <h3>{t('activity.learningOutcome')}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{data.learningOutcome}</p>
          </>
        ) : null}
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <span className="tag">{CATEGORY_LABELS[locale][data.category]}</span>
          {data.classLevels.map((level) => (
            <span className="tag" key={level}>
              {t('activity.classes')}: {level}
            </span>
          ))}
          {data.participantCount !== null ? (
            <span className="tag">
              {t('activity.participants')}: {data.participantCount}
            </span>
          ) : null}
        </div>
      </Card>

      {data.media.length > 0 ? (
        <Card>
          <h2>{t('activity.photos')}</h2>
          <div className="thumbs">
            {data.media.map((item) => (
              <a className="thumb" key={item.id} href={item.url} target="_blank" rel="noreferrer">
                <img src={item.url} alt={item.caption ?? ''} loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
          {canModerate ? (
            <MediaConsentChecklist
              activity={data}
              busy={busy}
              onChange={(mediaId, verified) =>
                run(() =>
                  api.post(`/v1/activities/${data.id}/media/${mediaId}/consent`, { verified }),
                )
              }
            />
          ) : null}
        </Card>
      ) : null}

      {data.recognisedStudents.length > 0 ? (
        <Card>
          <h2>{t('activity.students')}</h2>
          <ul style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
            {data.recognisedStudents.map((student) => (
              <li key={student.id}>
                {student.fullName} <span className="faint">({student.classLevel})</span>{' '}
                {student.hasMediaConsent ? (
                  <span className="tag tag--green">{t('consent.status.GRANTED')}</span>
                ) : (
                  <span className="tag tag--ochre">{t('consent.status.NONE')}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {actionError ? <ErrorNotice message={actionError} /> : null}

      {canSubmit ? (
        <SubmitPanel
          busy={busy}
          onSubmit={(visibility) =>
            run(() =>
              api.post(`/v1/activities/${data.id}/submit`, { requestedVisibility: visibility }),
            )
          }
        />
      ) : null}

      {canModerate ? (
        <ModerationPanel
          activity={data}
          busy={busy}
          onDecision={(body) => run(() => api.post(`/v1/activities/${data.id}/moderate`, body))}
        />
      ) : null}

      {isAuthor && data.status === 'DRAFT' ? (
        <p style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api.post(`/v1/activities/${data.id}/archive`);
                navigate('/app/activities');
              })
            }
          >
            {t('action.remove')}
          </button>
        </p>
      ) : null}
    </>
  );
}

function SubmitPanel({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (visibility: VisibilityLevel) => void;
}) {
  const { t } = useI18n();
  const [visibility, setVisibility] = useState<VisibilityLevel>('BLOCK');

  return (
    <Card>
      <h2>{t('action.submit')}</h2>
      <Field label={t('activity.visibility')} htmlFor="requestedVisibility">
        <select
          id="requestedVisibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as VisibilityLevel)}
        >
          {VISIBILITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`visibility.${level}`)}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy}
        onClick={() => onSubmit(visibility)}
      >
        {t('action.submit')}
      </button>
    </Card>
  );
}

function ModerationPanel({
  activity,
  busy,
  onDecision,
}: {
  activity: ActivityDetailType;
  busy: boolean;
  onDecision: (body: {
    decision: 'PUBLISH' | 'REJECT';
    visibility?: VisibilityLevel;
    reason?: string;
  }) => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [visibility, setVisibility] = useState<VisibilityLevel>(
    activity.requestedVisibility ?? 'BLOCK',
  );
  const [reason, setReason] = useState('');

  const blockers = activity.publishBlockers ?? [];
  // Everything except the visibility choice, which the moderator can still fix
  // by picking a narrower level right here.
  const hardBlockers = blockers.filter(
    (code) => code !== 'VISIBILITY_ABOVE_ROLE' && code !== 'VISIBILITY_ABOVE_REQUEST',
  );

  return (
    <Card>
      <h2>{t('review.title')}</h2>

      {hardBlockers.length > 0 ? (
        <div className="notice notice--warn">
          <strong>{t('review.blockers')}</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingInlineStart: '1.2rem' }}>
            {hardBlockers.map((code) => (
              <li key={code}>{BLOCKER_LABELS[locale][code] ?? code}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Field label={t('activity.visibility')} htmlFor="publishVisibility">
        <select
          id="publishVisibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as VisibilityLevel)}
        >
          {VISIBILITY_LEVELS.filter((level) =>
            user ? canApproveVisibility(user.role, level) : false,
          ).map((level) => (
            <option key={level} value={level}>
              {t(`visibility.${level}`)}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || hardBlockers.length > 0}
        onClick={() => onDecision({ decision: 'PUBLISH', visibility })}
      >
        {t('action.publish')}
      </button>

      <hr style={{ margin: '1.25rem 0', border: 0, borderTop: '1px solid var(--line)' }} />

      <Field
        label={t('review.rejectReason')}
        hint={t('review.rejectReasonHint')}
        htmlFor="rejectReason"
      >
        <textarea
          id="rejectReason"
          style={{ minHeight: '5rem' }}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </Field>
      <button
        type="button"
        className="btn btn--danger btn--block"
        disabled={busy || reason.trim().length < 3}
        onClick={() => onDecision({ decision: 'REJECT', reason })}
      >
        {t('action.reject')}
      </button>
    </Card>
  );
}

function MediaConsentChecklist({
  activity,
  busy,
  onChange,
}: {
  activity: ActivityDetailType;
  busy: boolean;
  onChange: (mediaId: string, verified: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div style={{ marginTop: '1rem' }}>
      {activity.media.map((item, index) => (
        <label className="checkline" key={item.id}>
          <input
            type="checkbox"
            disabled={busy}
            checked={item.consentVerified}
            onChange={(event) => onChange(item.id, event.target.checked)}
          />
          <span>
            {t('review.confirmMedia')} <span className="faint">#{index + 1}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
