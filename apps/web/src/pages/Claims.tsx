import { useState } from 'react';
import type { SchoolClaim } from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { SCHOOL_TYPE_LABELS } from '../lib/labels.js';
import { Card, EmptyState, ErrorNotice, Field, PageHeading, Spinner } from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * The block officer confirming school claims.
 *
 * This is the platform's front door, and the only place a school comes into
 * existence. The screen's job is to put the two facts the officer decides on
 * next to each other: whether the UDISE code is already in the register, and
 * who says they run it. Everything else is secondary.
 *
 * Verifying is a single click and rejecting demands a reason, which is the
 * right asymmetry: a wrongly-confirmed school can be suspended later, while a
 * head teacher rejected without explanation simply gives up on the platform.
 */
export function Claims() {
  const { t, d, locale } = useI18n();
  const pending = useApi<PagedResponse<SchoolClaim>>('/v1/school-claims?status=PENDING&limit=50');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [correctedName, setCorrectedName] = useState('');

  const decide = async (claim: SchoolClaim, body: Record<string, unknown>) => {
    setBusyId(claim.id);
    setError(null);
    try {
      await api.post(`/v1/school-claims/${claim.id}/decide`, body);
      setDone(body.decision === 'VERIFY' ? t('claims.verified') : null);
      setRejecting(null);
      setNote('');
      setCorrectedName('');
      pending.reload();
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeading title={t('claims.title')} />
      {error ? <ErrorNotice message={error} onRetry={pending.reload} /> : null}
      {done ? <p className="notice notice--success">{done}</p> : null}

      {pending.loading ? <Spinner /> : null}
      {pending.data && pending.data.items.length === 0 && !pending.loading ? (
        <EmptyState icon="🏫" title={t('claims.empty')} />
      ) : null}

      <div className="stack">
        {pending.data?.items.map((claim) => (
          <Card key={claim.id}>
            <div className="card__title">
              <div>
                <h3 style={{ margin: 0 }}>{claim.proposedNameHi}</h3>
                <p className="faint" style={{ margin: 0 }}>
                  UDISE {claim.udiseCode} · {SCHOOL_TYPE_LABELS[locale][claim.proposedType]}
                  {claim.villageOrWard ? ` · ${claim.villageOrWard}` : ''}
                </p>
                <p className="faint" style={{ margin: 0 }}>
                  {claim.blockName} · {claim.districtName} · {d(claim.createdAt)}
                </p>
              </div>
            </div>

            {/* The single most decision-relevant fact, so it is not buried in a
                row of tags: a code already in the register means this claim is
                someone recognising an existing school, and a code that is not
                means confirming it brings a new school into being. */}
            {claim.matchesRegister ? (
              <p className="notice notice--success" style={{ marginTop: '0.75rem' }}>
                {t('claims.inRegister')}
                {claim.registeredNameHi ? (
                  <>
                    <br />
                    <span className="muted">
                      {t('claims.registeredAs')}: {claim.registeredNameHi}
                    </span>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="notice notice--warn" style={{ marginTop: '0.75rem' }}>
                {t('claims.notInRegister')}
              </p>
            )}

            <dl className="keyvals">
              <dt>{t('claims.claimant')}</dt>
              <dd>
                {claim.claimantName}
                {claim.claimantDesignation ? ` · ${claim.claimantDesignation}` : ''}
              </dd>
              <dt>{t('auth.phoneLabel')}</dt>
              <dd>{claim.claimantPhone}</dd>
              {claim.claimantEmployeeCode ? (
                <>
                  <dt>{t('register.employeeCodeLabel')}</dt>
                  <dd>{claim.claimantEmployeeCode}</dd>
                </>
              ) : null}
              <dt>{t('claim.expires')}</dt>
              <dd>{d(claim.expiresAt)}</dd>
            </dl>

            {claim.evidenceUrl ? (
              <div className="thumbs">
                <a
                  className="thumb"
                  href={claim.evidenceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={t('claim.boardPhoto')}
                >
                  <img src={claim.evidenceUrl} alt={t('claim.boardPhoto')} loading="lazy" />
                </a>
              </div>
            ) : null}

            {rejecting === claim.id ? (
              <div style={{ marginTop: '0.75rem' }}>
                <Field label={t('claims.rejectReason')} htmlFor={`claimNote-${claim.id}`}>
                  <input
                    id={`claimNote-${claim.id}`}
                    type="text"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--danger btn--small"
                    disabled={busyId === claim.id || note.trim().length < 3}
                    onClick={() => decide(claim, { decision: 'REJECT', note })}
                  >
                    {t('action.reject')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => {
                      setRejecting(null);
                      setNote('');
                    }}
                  >
                    {t('action.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Field
                  label={t('claims.correctName')}
                  hint={t('claims.correctNameHint')}
                  htmlFor={`claimName-${claim.id}`}
                >
                  <input
                    id={`claimName-${claim.id}`}
                    type="text"
                    placeholder={claim.proposedNameHi}
                    value={correctedName}
                    onChange={(event) => setCorrectedName(event.target.value)}
                  />
                </Field>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--primary btn--small"
                    disabled={busyId === claim.id}
                    onClick={() =>
                      decide(claim, {
                        decision: 'VERIFY',
                        ...(correctedName.trim().length >= 3
                          ? { correctedNameHi: correctedName.trim() }
                          : {}),
                      })
                    }
                  >
                    {t('claims.verify')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => setRejecting(claim.id)}
                  >
                    {t('action.reject')}
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
