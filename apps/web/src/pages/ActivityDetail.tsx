import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ATTESTATION_TEXT,
  UNCONDITIONAL_PUBLISH_BLOCKERS,
  VISIBILITY_LEVELS,
  VISIBILITY_RANK,
  canApproveVisibility,
  needsClearance,
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
import { TrustCard } from '../components/TrustCard.js';
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
  /**
   * An officer above the school raising the visibility of work that already
   * passed the gate.
   *
   * A district officer who sees something worth showing the state should not
   * have to send it back through the school to do so. The API allows exactly
   * this promotion and refuses everything else, so the condition here mirrors
   * it: already published, already cleared, and the viewer is not the school
   * that produced it.
   */
  const canPromote =
    may('activity:clear') &&
    data.status === 'PUBLISHED' &&
    (data.clearance === 'CLEARED' || data.clearance === 'AUTO_CLEARED') &&
    user !== null &&
    !isAuthor;

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
            <ClearanceTag activity={data} />
          </div>
        }
      />

      <ClearanceNotice activity={data} />

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

      {canPromote ? (
        <PromotionPanel
          activity={data}
          busy={busy}
          onPromote={(visibility) =>
            run(() =>
              api.post(`/v1/activities/${data.id}/moderate`, { decision: 'PUBLISH', visibility }),
            )
          }
        />
      ) : null}

      {may('activity:clear') && !isAuthor ? <TrustCard schoolId={data.schoolId} /> : null}

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

/**
 * The head teacher's decision on a colleague's work.
 *
 * Split deliberately into two buttons rather than one button and a dropdown,
 * because they are not variations of the same act. Publishing inside the school
 * is the school keeping its own record and needs nobody else. Sending the work
 * beyond the school is a named statement by the head teacher that they saw it
 * happen and that the consent slips are on file — and it puts the item in front
 * of the block officer, who is the first person in the chain who does not work
 * in this building.
 *
 * The attestation cannot be a tick-box the head teacher clicks past: the full
 * sentence they are signing is on screen above the box, in their language.
 */
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
    attestation?: { confirmed: true; note?: string };
  }) => void;
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const requested = activity.requestedVisibility;

  /**
   * Never offer a level the API will refuse.
   *
   * A moderator may narrow what a teacher asked for but never widen it, so the
   * teacher's request is the ceiling here alongside the moderator's own role.
   * When the teacher asked for a school-internal record there is nothing to
   * attest and the whole section disappears.
   */
  const ceiling = requested ?? 'BLOCK';
  const allowedLevels = VISIBILITY_LEVELS.filter(
    (level) =>
      level !== 'SCHOOL' &&
      VISIBILITY_RANK[level] <= VISIBILITY_RANK[ceiling] &&
      (user ? canApproveVisibility(user.role, level) : false),
  );

  // Default to what the teacher asked for, and to the most they can be given
  // when that is out of this moderator's reach — never to a value the select
  // does not list, which would submit something the screen never showed.
  const [visibility, setVisibility] = useState<VisibilityLevel>(
    () => allowedLevels[allowedLevels.length - 1] ?? 'BLOCK',
  );
  const [confirmed, setConfirmed] = useState(false);
  const [attestationNote, setAttestationNote] = useState('');
  const [reason, setReason] = useState('');

  const blockers = activity.publishBlockers ?? [];

  /**
   * The server evaluates blockers against one visibility — the one the teacher
   * asked for — while this screen offers two decisions. So the list is split by
   * which of them each blocker actually stops.
   *
   * Getting this wrong in the safe-looking direction is the harmful one: a
   * consent gap computed for a PUBLIC request is not a reason the school cannot
   * keep its own record, and treating it as one would grey out the head
   * teacher's only legal action with no way to discover why.
   */
  const alwaysBlocking = blockers.filter((code) =>
    (UNCONDITIONAL_PUBLISH_BLOCKERS as readonly string[]).includes(code),
  );
  // Excludes the two the moderator resolves on this very screen: a visibility
  // that is too high by picking a lower one, a missing attestation by the box.
  const sendOnBlocking = blockers.filter(
    (code) =>
      code !== 'VISIBILITY_ABOVE_ROLE' &&
      code !== 'VISIBILITY_ABOVE_REQUEST' &&
      code !== 'ATTESTATION_REQUIRED' &&
      code !== 'BLOCK_CLEARANCE_REQUIRED',
  );

  return (
    <Card>
      <h2>{t('review.title')}</h2>

      {sendOnBlocking.length > 0 ? (
        <div className="notice notice--warn">
          <strong>{t('review.blockers')}</strong>
          <ul style={{ margin: '0.5rem 0 0', paddingInlineStart: '1.2rem' }}>
            {sendOnBlocking.map((code) => (
              <li key={code}>{BLOCKER_LABELS[locale][code] ?? code}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || alwaysBlocking.length > 0}
        onClick={() => onDecision({ decision: 'PUBLISH', visibility: 'SCHOOL' })}
      >
        {t('attest.publishSchool')}
      </button>
      <p className="faint" style={{ marginTop: '0.4rem' }}>
        {t('attest.publishSchoolHint')}
      </p>

      {allowedLevels.length > 0 ? (
        <>
          <hr style={{ margin: '1.25rem 0', border: 0, borderTop: '1px solid var(--line)' }} />
          <h3 style={{ marginTop: 0 }}>{t('attest.title')}</h3>

          <Field label={t('activity.visibility')} htmlFor="publishVisibility">
            <select
              id="publishVisibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as VisibilityLevel)}
            >
              {allowedLevels.map((level) => (
                <option key={level} value={level}>
                  {t(`visibility.${level}`)}
                </option>
              ))}
            </select>
          </Field>

          {/* The statement itself, not a summary of it. A head teacher is
              putting their name to these words and has to be able to read
              them. */}
          <blockquote className="attestation">{ATTESTATION_TEXT[locale]}</blockquote>

          <label className="checkline">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>{t('attest.confirm')}</span>
          </label>

          <Field label={t('attest.note')} htmlFor="attestationNote">
            <textarea
              id="attestationNote"
              style={{ minHeight: '3.5rem' }}
              value={attestationNote}
              onChange={(event) => setAttestationNote(event.target.value)}
            />
          </Field>

          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy || sendOnBlocking.length > 0 || !confirmed}
            onClick={() =>
              onDecision({
                decision: 'PUBLISH',
                visibility,
                attestation: {
                  confirmed: true,
                  ...(attestationNote.trim() ? { note: attestationNote.trim() } : {}),
                },
              })
            }
          >
            {t('attest.sendOn')}
          </button>
          <p className="faint" style={{ marginTop: '0.4rem' }}>
            {needsClearance(visibility) ? t('attest.sendOnHint') : null}
          </p>
        </>
      ) : null}

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

/**
 * Raising the reach of work that has already been through the gate.
 *
 * Offers only levels above where the item already sits: the API refuses to
 * lower a published activity's visibility through this path, and a control that
 * looks available but always fails is worse than no control.
 */
function PromotionPanel({
  activity,
  busy,
  onPromote,
}: {
  activity: ActivityDetailType;
  busy: boolean;
  onPromote: (visibility: VisibilityLevel) => void;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const current = VISIBILITY_LEVELS.indexOf(activity.visibility);
  const higher = VISIBILITY_LEVELS.filter(
    (level, index) => index > current && (user ? canApproveVisibility(user.role, level) : false),
  );
  const [visibility, setVisibility] = useState<VisibilityLevel | ''>('');

  if (higher.length === 0) return null;

  return (
    <Card>
      <h2>{t('promote.title')}</h2>
      <p className="muted">{t('promote.hint')}</p>
      <Field label={t('activity.visibility')} htmlFor="promoteVisibility">
        <select
          id="promoteVisibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as VisibilityLevel)}
        >
          <option value="">—</option>
          {higher.map((level) => (
            <option key={level} value={level}>
              {t(`visibility.${level}`)}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || visibility === ''}
        onClick={() => visibility !== '' && onPromote(visibility)}
      >
        {t('promote.action')}
      </button>
    </Card>
  );
}

/** How far this activity has travelled, in one word. */
function ClearanceTag({ activity }: { activity: ActivityDetailType }) {
  const { t } = useI18n();
  if (activity.clearance === 'NOT_REQUIRED') return null;
  const tone =
    activity.clearance === 'CLEARED' || activity.clearance === 'AUTO_CLEARED'
      ? 'tag tag--green'
      : activity.clearance === 'RETURNED'
        ? 'tag tag--danger'
        : 'tag tag--ochre';
  return <span className={tone}>{t(`clear.${activity.clearance}`)}</span>;
}

/**
 * The sentence a teacher needs when their work is not where they expected.
 *
 * "Published" and "visible outside the school" are different things now, and a
 * teacher who submitted for district visibility and sees SCHOOL on the page
 * deserves to be told why rather than left to guess.
 */
function ClearanceNotice({ activity }: { activity: ActivityDetailType }) {
  const { t, d } = useI18n();

  if (activity.clearance === 'AWAITING_BLOCK') {
    return (
      <div className="notice notice--warn" style={{ marginBottom: '1rem' }}>
        <strong>{t('attest.awaitingBlock')}</strong>
        {activity.attestedByName ? (
          <p style={{ margin: '0.5rem 0 0' }}>
            {t('attest.by')}: {activity.attestedByName}
            {activity.attestedAt ? ` · ${d(activity.attestedAt)}` : ''}
          </p>
        ) : null}
        {activity.attestationNote ? (
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {activity.attestationNote}
          </p>
        ) : null}
      </div>
    );
  }

  if (activity.clearance === 'RETURNED') {
    return (
      <div className="notice notice--error" style={{ marginBottom: '1rem' }}>
        <strong>{t('clear.RETURNED')}</strong>
        {activity.clearanceNote ? (
          <p style={{ margin: '0.5rem 0 0' }}>{activity.clearanceNote}</p>
        ) : null}
        {activity.clearedByName ? (
          <p className="faint" style={{ margin: '0.25rem 0 0' }}>
            {activity.clearedByName}
            {activity.clearedAt ? ` · ${d(activity.clearedAt)}` : ''}
          </p>
        ) : null}
      </div>
    );
  }

  if (activity.clearance === 'CLEARED' && activity.clearedByName) {
    return (
      <p className="faint" style={{ marginBottom: '1rem' }}>
        {t('clear.CLEARED')}: {activity.clearedByName}
        {activity.clearedAt ? ` · ${d(activity.clearedAt)}` : ''}
      </p>
    );
  }

  return null;
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
            checked={item.noIdentifiableChild}
            onChange={(event) => onChange(item.id, event.target.checked)}
          />
          <span>
            {t('media.noChildConfirm')} <span className="faint">#{index + 1}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
