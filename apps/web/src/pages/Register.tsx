import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { RequestOtpResponse, SchoolLookup } from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { Card, ErrorNotice, Field, PageHeading } from '../components/ui.js';
import { TopBar } from '../components/Shell.js';
import { describe } from './SignIn.js';

/**
 * Teacher self-registration.
 *
 * Three steps, in the order that fails cheapest: confirm the school first, so
 * nobody types their name and designation only to find they entered the wrong
 * UDISE code; then verify the phone; then submit. The account lands in the head
 * teacher's approval queue — self-registration alone never grants access.
 */
export function Register() {
  const { t } = useI18n();
  const [step, setStep] = useState<'school' | 'details' | 'done'>('school');
  const [school, setSchool] = useState<SchoolLookup | null>(null);
  const [udiseCode, setUdiseCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const findSchool = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const found = await api.get<SchoolLookup>(
        `/v1/schools/lookup?udiseCode=${encodeURIComponent(udiseCode)}`,
        { anonymous: true },
      );
      setSchool(found);
      setStep('details');
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <TopBar />
      <main className="main" id="main" style={{ maxWidth: '32rem' }}>
        <PageHeading title={t('register.title')} subtitle={t('app.tagline')} />

        {step === 'school' ? (
          <Card>
            <form onSubmit={findSchool} noValidate>
              <Field
                label={t('register.udiseLabel')}
                hint={t('register.udiseHint')}
                htmlFor="udise"
              >
                <input
                  id="udise"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{11}"
                  maxLength={11}
                  required
                  value={udiseCode}
                  onChange={(event) => setUdiseCode(event.target.value.replace(/\D/g, ''))}
                  aria-describedby="udise-hint"
                />
              </Field>
              {error ? <ErrorNotice message={error} /> : null}
              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={busy || udiseCode.length !== 11}
              >
                {busy ? <span className="spinner" aria-hidden="true" /> : null}
                {t('register.findSchool')}
              </button>
            </form>
          </Card>
        ) : null}

        {step === 'details' && school ? (
          <DetailsStep school={school} onDone={() => setStep('done')} />
        ) : null}

        {step === 'done' ? (
          <Card>
            <p className="notice notice--success">{t('register.submitted')}</p>
            <Link className="btn btn--primary btn--block" to="/signin">
              {t('action.signIn')}
            </Link>
          </Card>
        ) : null}

        <p className="muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/signin">{t('action.back')}</Link>
        </p>
      </main>
    </div>
  );
}

function DetailsStep({ school, onDone }: { school: SchoolLookup; onDone: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ fullName: '', designation: '', employeeCode: '', phone: '' });
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<RequestOtpResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(
        await api.post<RequestOtpResponse>(
          '/v1/auth/otp/request',
          { phone: form.phone, purpose: 'REGISTRATION' },
          { anonymous: true },
        ),
      );
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post(
        '/v1/auth/register',
        {
          phone: form.phone,
          code,
          fullName: form.fullName,
          udiseCode: school.udiseCode,
          ...(form.designation ? { designation: form.designation } : {}),
          ...(form.employeeCode ? { employeeCode: form.employeeCode } : {}),
        },
        { anonymous: true },
      );
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
      <div className="notice notice--success" style={{ marginBottom: '1rem' }}>
        <strong>{school.nameHi}</strong>
        <br />
        <span className="muted">
          {school.blockName} · {school.districtName} · {school.udiseCode}
        </span>
      </div>

      <form onSubmit={sent ? submit : sendCode} noValidate>
        <Field label={t('register.nameLabel')} error={fieldErrors.fullName?.[0]} htmlFor="fullName">
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
            aria-invalid={Boolean(fieldErrors.fullName)}
          />
        </Field>
        <Field label={t('register.designationLabel')} htmlFor="designation">
          <input
            id="designation"
            type="text"
            value={form.designation}
            onChange={(event) => setForm({ ...form, designation: event.target.value })}
          />
        </Field>
        <Field label={t('register.employeeCodeLabel')} htmlFor="employeeCode">
          <input
            id="employeeCode"
            type="text"
            value={form.employeeCode}
            onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
          />
        </Field>
        <Field
          label={t('auth.phoneLabel')}
          hint={t('auth.phoneHint')}
          error={fieldErrors.phone?.[0]}
          htmlFor="regPhone"
        >
          <input
            id="regPhone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            disabled={Boolean(sent)}
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            aria-invalid={Boolean(fieldErrors.phone)}
          />
        </Field>

        {sent ? (
          <>
            <p className="notice notice--success">{t('auth.codeSent')}</p>
            {sent.devCode ? (
              <p className="notice notice--warn">
                Development build — the code is <strong>{sent.devCode}</strong>.
              </p>
            ) : null}
            <Field label={t('auth.codeLabel')} htmlFor="regCode">
              <input
                id="regCode"
                className="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              />
            </Field>
          </>
        ) : null}

        {error ? <ErrorNotice message={error} /> : null}

        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={
            busy || !form.fullName || form.phone.length < 10 || (Boolean(sent) && code.length !== 6)
          }
        >
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {sent ? t('action.register') : t('auth.sendCode')}
        </button>
      </form>

      <p className="faint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        {t('auth.pending')}
      </p>
    </Card>
  );
}
