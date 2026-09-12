import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { RequestOtpResponse } from '@balsanskar/shared';
import { ApiRequestError, NetworkError, api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { Card, ErrorNotice, Field, PageHeading } from '../components/ui.js';
import { TopBar } from '../components/Shell.js';

/**
 * Signing in.
 *
 * Two paths, because the two audiences are genuinely different. A teacher gets
 * a code on the phone the department already has on file — no password to
 * forget, no email address they may not have. An officer, who can act on other
 * people's accounts, uses a password from an office machine, because a
 * credential that can be intercepted by holding a SIM is not enough for that.
 */
export function SignIn() {
  const { t } = useI18n();
  const { status, signInWithOtp, signInWithPassword } = useAuth();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');

  if (status === 'authenticated') return <Navigate to="/app" replace />;

  return (
    <div className="app">
      <TopBar />
      <main className="main" id="main" style={{ maxWidth: '30rem' }}>
        <PageHeading title={t('auth.title')} subtitle={t('app.tagline')} />
        {mode === 'otp' ? (
          <OtpForm onSignIn={signInWithOtp} />
        ) : (
          <PasswordForm onSignIn={signInWithPassword} />
        )}
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => setMode(mode === 'otp' ? 'password' : 'otp')}
          >
            {mode === 'otp' ? t('auth.usePassword') : t('auth.useOtp')}
          </button>
        </p>
        <p className="muted" style={{ textAlign: 'center' }}>
          {t('auth.noAccount')} <Link to="/register">{t('auth.registerLink')}</Link>
        </p>
        <p className="muted" style={{ textAlign: 'center' }}>
          {t('claim.link')} <Link to="/claim">{t('claim.title')}</Link>
        </p>
        <p className="faint" style={{ textAlign: 'center' }}>
          <Link to="/showcase">{t('nav.showcase')}</Link>
        </p>
      </main>
    </div>
  );
}

function OtpForm({ onSignIn }: { onSignIn: (phone: string, code: string) => Promise<void> }) {
  const { t } = useI18n();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<RequestOtpResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSent(
        await api.post<RequestOtpResponse>(
          '/v1/auth/otp/request',
          { phone, purpose: 'LOGIN' },
          { anonymous: true },
        ),
      );
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSignIn(phone, code);
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      {!sent ? (
        <form onSubmit={requestCode} noValidate>
          <Field label={t('auth.phoneLabel')} hint={t('auth.phoneHint')} htmlFor="phone">
            <input
              id="phone"
              name="phone"
              // `tel` opens the numeric keypad; `inputMode` covers the WebViews
              // that ignore the type on a text field.
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={17}
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-describedby="phone-hint"
            />
          </Field>
          {error ? <ErrorNotice message={error} /> : null}
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={busy || phone.length < 10}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {t('auth.sendCode')}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <p className="notice notice--success">{t('auth.codeSent')}</p>
          {sent.devCode ? (
            <p className="notice notice--warn">
              Development build — the code is <strong>{sent.devCode}</strong>. This never appears in
              production.
            </p>
          ) : null}
          <Field label={t('auth.codeLabel')} htmlFor="code">
            <input
              id="code"
              name="code"
              className="otp-input"
              type="text"
              inputMode="numeric"
              // Lets Android and iOS fill the code straight from the SMS.
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </Field>
          {error ? <ErrorNotice message={error} /> : null}
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={busy || code.length !== 6}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {t('action.signIn')}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--block"
            style={{ marginTop: '0.5rem' }}
            onClick={() => {
              setSent(null);
              setCode('');
            }}
          >
            {t('action.back')}
          </button>
        </form>
      )}
    </Card>
  );
}

function PasswordForm({
  onSignIn,
}: {
  onSignIn: (identifier: string, password: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSignIn(identifier, password);
    } catch (caught) {
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.identifierLabel')} htmlFor="identifier">
          <input
            id="identifier"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </Field>
        <Field label={t('auth.passwordLabel')} htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? <ErrorNotice message={error} /> : null}
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {t('action.signIn')}
        </button>
      </form>
    </Card>
  );
}

/**
 * Turns a thrown value into something worth showing a teacher.
 *
 * The server's message is used when there is one: it says "your account is
 * waiting for approval" or "3 attempts left", which is far more useful than any
 * generic string this layer could invent.
 */
export function describe(error: unknown, fallback: string): string {
  if (error instanceof NetworkError) return 'नेटवर्क उपलब्ध नहीं है / No network available.';
  if (error instanceof ApiRequestError) return error.message;
  return fallback;
}
