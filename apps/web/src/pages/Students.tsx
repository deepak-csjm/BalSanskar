import { useState, type FormEvent } from 'react';
import {
  CLASS_LEVELS,
  CONSENT_METHODS,
  GENDERS,
  type ClassLevel,
  type ConsentRecord,
  type Gender,
  type Student,
} from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { GENDER_LABELS } from '../lib/labels.js';
import {
  Card,
  ConsentTag,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeading,
  Spinner,
} from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * The class roster, and the consent record attached to each child.
 *
 * Consent is shown on the roster itself rather than hidden behind a detail
 * screen. It is the single fact a teacher needs before deciding whether they
 * can name a child in a public post, and burying it would guarantee it is not
 * checked.
 */
export function Students() {
  const { t } = useI18n();
  const [classLevel, setClassLevel] = useState('');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);

  const query = new URLSearchParams({ limit: '100' });
  if (classLevel) query.set('classLevel', classLevel);

  const { data, error, loading, reload, offline } = useApi<PagedResponse<Student>>(
    `/v1/students?${query.toString()}`,
    [classLevel],
  );

  return (
    <>
      <PageHeading
        title={t('nav.students')}
        action={
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => setAdding(true)}
          >
            + {t('action.addStudent')}
          </button>
        }
      />

      {adding ? (
        <AddStudentForm
          onDone={() => {
            setAdding(false);
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}

      {selected ? (
        <ConsentPanel
          student={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            reload();
          }}
        />
      ) : null}

      <Card>
        <Field label={t('student.class')} htmlFor="classFilter">
          <select
            id="classFilter"
            value={classLevel}
            onChange={(event) => setClassLevel(event.target.value)}
          >
            <option value="">—</option>
            {CLASS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level === 'BALVATIKA' ? 'बालवाटिका' : level}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      {loading ? <Spinner /> : null}
      {error && !loading ? (
        <ErrorNotice message={offline ? t('error.offline') : t('error.generic')} onRetry={reload} />
      ) : null}
      {data && data.items.length === 0 && !loading ? (
        <EmptyState icon="🧒" title={t('student.empty')} />
      ) : null}

      <div className="stack">
        {data?.items.map((student) => (
          <Card key={student.id}>
            <div className="card__title">
              <div>
                <h3 style={{ margin: 0 }}>{student.fullName}</h3>
                <p className="faint" style={{ margin: 0 }}>
                  {t('student.class')} {student.classLevel}
                  {student.section ? ` · ${student.section}` : ''}
                  {student.rollNumber ? ` · ${t('student.roll')} ${student.rollNumber}` : ''}
                </p>
              </div>
              <ConsentTag status={student.mediaConsent} />
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              style={{ marginTop: '0.5rem' }}
              onClick={() => setSelected(student)}
            >
              {t('consent.title')}
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}

function AddStudentForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState<{
    fullName: string;
    classLevel: ClassLevel;
    section: string;
    rollNumber: string;
    gender: Gender;
    guardianName: string;
    guardianPhone: string;
  }>({
    fullName: '',
    classLevel: '1',
    section: '',
    rollNumber: '',
    gender: 'FEMALE',
    guardianName: '',
    guardianPhone: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post('/v1/students', {
        fullName: form.fullName,
        classLevel: form.classLevel,
        gender: form.gender,
        guardianName: form.guardianName,
        ...(form.section ? { section: form.section } : {}),
        ...(form.rollNumber ? { rollNumber: form.rollNumber } : {}),
        ...(form.guardianPhone ? { guardianPhone: form.guardianPhone } : {}),
      });
      onDone();
    } catch (caught) {
      if (caught && typeof caught === 'object' && 'fields' in caught) {
        setFieldErrors((caught as { fields?: Record<string, string[]> }).fields ?? {});
      }
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2>{t('action.addStudent')}</h2>
      <form onSubmit={submit} noValidate>
        <Field label={t('student.name')} error={fieldErrors.fullName?.[0]} htmlFor="studentName">
          <input
            id="studentName"
            type="text"
            required
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
          />
        </Field>
        <div className="row">
          <Field label={t('student.class')} htmlFor="studentClass">
            <select
              id="studentClass"
              value={form.classLevel}
              onChange={(event) =>
                setForm({ ...form, classLevel: event.target.value as ClassLevel })
              }
            >
              {CLASS_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level === 'BALVATIKA' ? 'बालवाटिका' : level}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('student.section')} htmlFor="studentSection">
            <input
              id="studentSection"
              type="text"
              maxLength={8}
              value={form.section}
              onChange={(event) => setForm({ ...form, section: event.target.value })}
            />
          </Field>
          <Field label={t('student.roll')} htmlFor="studentRoll">
            <input
              id="studentRoll"
              type="text"
              maxLength={16}
              value={form.rollNumber}
              onChange={(event) => setForm({ ...form, rollNumber: event.target.value })}
            />
          </Field>
        </div>
        <Field label={t('student.gender')} htmlFor="studentGender">
          <select
            id="studentGender"
            value={form.gender}
            onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}
          >
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {GENDER_LABELS[locale][gender]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t('student.guardian')}
          error={fieldErrors.guardianName?.[0]}
          htmlFor="guardianName"
        >
          <input
            id="guardianName"
            type="text"
            required
            value={form.guardianName}
            onChange={(event) => setForm({ ...form, guardianName: event.target.value })}
          />
        </Field>
        <Field label={t('student.guardianPhone')} htmlFor="guardianPhone">
          <input
            id="guardianPhone"
            type="tel"
            inputMode="numeric"
            value={form.guardianPhone}
            onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })}
          />
        </Field>

        {error ? <ErrorNotice message={error} /> : null}

        <div className="row">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {t('action.save')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {t('action.cancel')}
          </button>
        </div>
      </form>
    </Card>
  );
}

/**
 * Recording and withdrawing consent.
 *
 * The withdrawal path carries an explicit warning because it is not reversible
 * in effect: the server immediately pulls every public photograph of the child.
 * A teacher should know that before pressing it, not discover it afterwards.
 */
function ConsentPanel({
  student,
  onClose,
  onChanged,
}: {
  student: Student;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, d } = useI18n();
  const history = useApi<{ items: ConsentRecord[] }>(`/v1/students/${student.id}/consent`);
  const [form, setForm] = useState({
    status: 'GRANTED',
    method: 'PAPER_FORM',
    guardianName: student.guardianName,
    guardianRelation: '',
  });
  const [revokeReason, setRevokeReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const record = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/v1/students/${student.id}/consent`, {
        status: form.status,
        method: form.method,
        guardianName: form.guardianName,
        ...(form.guardianRelation ? { guardianRelation: form.guardianRelation } : {}),
      });
      history.reload();
      onChanged();
      setResult(t('action.save'));
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post<{ unpublishedActivityCount: number }>(
        `/v1/students/${student.id}/consent/revoke`,
        { reason: revokeReason },
      );
      history.reload();
      onChanged();
      setResult(
        response.unpublishedActivityCount > 0
          ? `${response.unpublishedActivityCount} सार्वजनिक गतिविधियाँ हटाई गईं / removed from public view`
          : t('consent.status.REVOKED'),
      );
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="card__title">
        <h2 style={{ margin: 0 }}>
          {t('consent.title')} — {student.fullName}
        </h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          {t('action.cancel')}
        </button>
      </div>

      <p className="muted">{t('consent.explain')}</p>

      {result ? <div className="notice notice--success">{result}</div> : null}
      {error ? <ErrorNotice message={error} /> : null}

      <form onSubmit={record} noValidate>
        <Field label={t('consent.status.GRANTED')} htmlFor="consentStatus">
          <select
            id="consentStatus"
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="GRANTED">{t('consent.status.GRANTED')}</option>
            <option value="DENIED">{t('consent.status.DENIED')}</option>
          </select>
        </Field>
        <Field label={t('consent.method.PAPER_FORM')} htmlFor="consentMethod">
          <select
            id="consentMethod"
            value={form.method}
            onChange={(event) => setForm({ ...form, method: event.target.value })}
          >
            {CONSENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`consent.method.${method}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('consent.guardianName')} htmlFor="consentGuardian">
          <input
            id="consentGuardian"
            type="text"
            required
            value={form.guardianName}
            onChange={(event) => setForm({ ...form, guardianName: event.target.value })}
          />
        </Field>
        <Field label={t('consent.relation')} htmlFor="consentRelation">
          <input
            id="consentRelation"
            type="text"
            value={form.guardianRelation}
            onChange={(event) => setForm({ ...form, guardianRelation: event.target.value })}
          />
        </Field>
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {t('action.recordConsent')}
        </button>
      </form>

      {student.mediaConsent === 'GRANTED' ? (
        <details style={{ marginTop: '1.25rem' }}>
          <summary style={{ minHeight: 'var(--tap)', cursor: 'pointer' }}>
            {t('consent.revoke')}
          </summary>
          <div className="notice notice--warn" style={{ margin: '0.5rem 0' }}>
            {t('consent.revokeWarning')}
          </div>
          <Field label={t('consent.revokeReason')} htmlFor="revokeReason">
            <input
              id="revokeReason"
              type="text"
              value={revokeReason}
              onChange={(event) => setRevokeReason(event.target.value)}
            />
          </Field>
          <button
            type="button"
            className="btn btn--danger btn--block"
            disabled={busy || revokeReason.trim().length < 3}
            onClick={() => void revoke()}
          >
            {t('consent.revoke')}
          </button>
        </details>
      ) : null}

      {history.data && history.data.items.length > 0 ? (
        <div style={{ marginTop: '1.25rem' }}>
          <h3>{t('consent.title')}</h3>
          <ul style={{ margin: 0, paddingInlineStart: '1.2rem' }}>
            {history.data.items.map((entry) => (
              <li key={entry.id} className="muted">
                {t(`consent.status.${entry.status}`)} · {t(`consent.method.${entry.method}`)} ·{' '}
                {d(entry.recordedAt)} · {entry.recordedByName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
