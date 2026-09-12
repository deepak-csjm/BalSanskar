import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ClearanceQueueItem } from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { RISK_FLAG_LABELS } from '../lib/labels.js';
import { Card, EmptyState, ErrorNotice, Field, PageHeading, Spinner } from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * The gate out of the school.
 *
 * A head teacher can publish their school's own record on their own authority.
 * Anything meant to be seen outside the school passes through here, because the
 * teacher who wrote it and the head teacher who attested it work in the same
 * building — two signatures from one office are not two independent checks.
 *
 * The queue is ordered by risk rather than by date, and every item says in one
 * sentence why it is in front of the officer. An officer with ten minutes
 * should spend them on the ten riskiest items, not the ten oldest; the
 * "flagged only" switch is that ten minutes made explicit.
 */
export function Clearance() {
  const { t } = useI18n();
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const queue = useApi<PagedResponse<ClearanceQueueItem>>(
    `/v1/clearance-queue?limit=50&flaggedOnly=${flaggedOnly}`,
    [flaggedOnly],
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <>
      <PageHeading title={t('clearance.title')} subtitle={t('clearance.intro')} />

      <label className="checkline" style={{ marginBottom: '0.75rem' }}>
        <input
          type="checkbox"
          checked={flaggedOnly}
          onChange={(event) => setFlaggedOnly(event.target.checked)}
        />
        <span>{t('clearance.flaggedOnly')}</span>
      </label>

      {error ? <ErrorNotice message={error} onRetry={queue.reload} /> : null}
      {done ? <p className="notice notice--success">{done}</p> : null}

      {queue.loading ? <Spinner /> : null}
      {queue.error && !queue.loading ? (
        <ErrorNotice
          message={queue.offline ? t('error.offline') : t('error.generic')}
          onRetry={queue.reload}
        />
      ) : null}
      {queue.data && queue.data.items.length === 0 && !queue.loading ? (
        <EmptyState icon="✅" title={t('clearance.empty')} />
      ) : null}

      <div className="stack">
        {queue.data?.items.map((item) => (
          <QueueItem
            key={item.activityId}
            item={item}
            onDecided={(message) => {
              setDone(message);
              setError(null);
              queue.reload();
            }}
            onFailed={setError}
          />
        ))}
      </div>
    </>
  );
}

function QueueItem({
  item,
  onDecided,
  onFailed,
}: {
  item: ClearanceQueueItem;
  onDecided: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const { t, d, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');

  const decide = async (body: { decision: 'CLEAR' | 'RETURN'; note?: string }) => {
    setBusy(true);
    try {
      await api.post(`/v1/activities/${item.activityId}/clearance`, body);
      onDecided(body.decision === 'CLEAR' ? t('clearance.cleared') : t('clearance.returned'));
    } catch (caught) {
      onFailed(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="card__title">
        <div>
          <h3 style={{ margin: 0 }}>
            <Link to={`/app/activities/${item.activityId}`}>{item.title}</Link>
          </h3>
          <p className="faint" style={{ margin: 0 }}>
            {item.schoolName} · {d(item.occurredOn)} · {item.authorName}
          </p>
          {item.attestedByName ? (
            <p className="faint" style={{ margin: 0 }}>
              {t('attest.by')}: {item.attestedByName}
              {item.attestedAt ? ` · ${d(item.attestedAt)}` : ''}
            </p>
          ) : null}
        </div>
        <div className="row">
          <span className={item.reason === 'FLAGGED' ? 'tag tag--ochre' : 'tag'}>
            {t(`clearance.reason${item.reason}`)}
          </span>
          <span className={item.schoolTrustTier === 'WATCH' ? 'tag tag--danger' : 'tag'}>
            {t(`tier.${item.schoolTrustTier}`)}
          </span>
          <span className="tag tag--info">{t(`visibility.${item.target}`)}</span>
        </div>
      </div>

      {item.coverUrl ? (
        <div className="thumbs">
          <a className="thumb" href={item.coverUrl} target="_blank" rel="noreferrer">
            <img src={item.coverUrl} alt="" loading="lazy" decoding="async" />
          </a>
        </div>
      ) : null}

      {/* The flags, in the API's own words. The short label orients the officer;
          the sentence underneath is what they act on. Nothing here is a verdict
          — a flag says "look", never "this is false". */}
      {item.riskFlags.length > 0 ? (
        <div className="notice notice--warn" style={{ marginTop: '0.75rem' }}>
          <strong>
            {t('clearance.why')} · {t('clearance.risk')} {item.riskScore}
          </strong>
          <ul style={{ margin: '0.5rem 0 0', paddingInlineStart: '1.2rem' }}>
            {item.riskFlags.map((flag, index) => (
              <li key={flag}>
                <strong>{RISK_FLAG_LABELS[locale][flag]}</strong>
                {item.riskNotes[index] ? <> — {item.riskNotes[index]}</> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          {t('clearance.sampledHint')}
        </p>
      )}

      {returning ? (
        <div style={{ marginTop: '0.75rem' }}>
          <Field
            label={t('clearance.returnReason')}
            hint={t('clearance.returnReasonHint')}
            htmlFor={`returnNote-${item.activityId}`}
          >
            <textarea
              id={`returnNote-${item.activityId}`}
              style={{ minHeight: '4rem' }}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="row">
            <button
              type="button"
              className="btn btn--danger btn--small"
              disabled={busy || note.trim().length < 3}
              onClick={() => decide({ decision: 'RETURN', note })}
            >
              {t('clearance.return')}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => {
                setReturning(false);
                setNote('');
              }}
            >
              {t('action.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn--primary btn--small"
            disabled={busy}
            onClick={() => decide({ decision: 'CLEAR' })}
          >
            {t('clearance.clear')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={busy}
            onClick={() => setReturning(true)}
          >
            {t('clearance.return')}
          </button>
        </div>
      )}
    </Card>
  );
}
