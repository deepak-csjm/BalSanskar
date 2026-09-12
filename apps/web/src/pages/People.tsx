import { useState } from 'react';
import type { UserSummary } from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { Card, EmptyState, ErrorNotice, Field, PageHeading, Spinner } from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * Approving teachers.
 *
 * The gate between "someone typed a UDISE code" and "someone can upload
 * photographs of children at that school". It is deliberately the first thing a
 * head teacher sees on this screen, and rejection demands a reason so the
 * applicant is told what went wrong rather than left waiting.
 */
export function People() {
  const { t, d } = useI18n();
  const pending = useApi<PagedResponse<UserSummary>>('/v1/users?status=PENDING_APPROVAL&limit=50');
  const active = useApi<PagedResponse<UserSummary>>('/v1/users?status=ACTIVE&limit=50');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const act = async (id: string, work: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await work();
      pending.reload();
      active.reload();
      setRejecting(null);
      setReason('');
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeading title={t('nav.people')} />
      {error ? <ErrorNotice message={error} /> : null}

      <Card>
        <h2>{t('people.pending')}</h2>
        {pending.loading ? <Spinner /> : null}
        {pending.data && pending.data.items.length === 0 && !pending.loading ? (
          <EmptyState icon="👥" title={t('people.noPending')} />
        ) : null}

        <div className="stack">
          {pending.data?.items.map((person) => (
            <div className="card" style={{ boxShadow: 'none' }} key={person.id}>
              <div className="card__title">
                <div>
                  <h3 style={{ margin: 0 }}>{person.fullName}</h3>
                  <p className="faint" style={{ margin: 0 }}>
                    {person.phone}
                    {person.designation ? ` · ${person.designation}` : ''}
                    {person.employeeCode ? ` · ${person.employeeCode}` : ''}
                  </p>
                  <p className="faint" style={{ margin: 0 }}>
                    {person.schoolName} · {d(person.createdAt)}
                  </p>
                </div>
              </div>

              {rejecting === person.id ? (
                <div style={{ marginTop: '0.75rem' }}>
                  <Field label={t('review.rejectReason')} htmlFor={`reason-${person.id}`}>
                    <input
                      id={`reason-${person.id}`}
                      type="text"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      disabled={busyId === person.id || reason.trim().length < 3}
                      onClick={() =>
                        act(person.id, () => api.post(`/v1/users/${person.id}/reject`, { reason }))
                      }
                    >
                      {t('action.reject')}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => setRejecting(null)}
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
                    disabled={busyId === person.id}
                    onClick={() =>
                      act(person.id, () => api.post(`/v1/users/${person.id}/approve`, {}))
                    }
                  >
                    {t('action.approve')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => setRejecting(person.id)}
                  >
                    {t('action.reject')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2>{t('people.active')}</h2>
        {active.loading ? <Spinner /> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{t('register.nameLabel')}</th>
                <th scope="col">{t('register.designationLabel')}</th>
                <th scope="col">{t('report.schools')}</th>
              </tr>
            </thead>
            <tbody>
              {active.data?.items.map((person) => (
                <tr key={person.id}>
                  <th
                    scope="row"
                    style={{ background: 'transparent', textTransform: 'none', fontSize: '0.9rem' }}
                  >
                    {person.fullName}
                    <br />
                    <span className="faint">{person.role}</span>
                  </th>
                  <td>{person.designation ?? '—'}</td>
                  <td>{person.schoolName ?? person.blockName ?? person.districtName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
