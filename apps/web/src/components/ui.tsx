import type { ReactNode } from 'react';
import type {
  ActivityStatus,
  ConsentStatus,
  VerificationStatus,
  VisibilityLevel,
} from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';

/**
 * The small set of presentational pieces the screens are built from.
 *
 * Kept in one file and deliberately unabstracted: a component library would add
 * more kilobytes than the whole application currently ships, and none of these
 * needs a theme system.
 */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="card__title">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <p className="muted row" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> {label ?? t('loading')}
    </p>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="notice notice--error" role="alert">
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry ? (
        <p style={{ margin: '0.5rem 0 0' }}>
          <button type="button" className="btn btn--small" onClick={onRetry}>
            {t('action.retry')}
          </button>
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        {icon}
      </span>
      <p style={{ fontWeight: 600, margin: 0 }}>{title}</p>
      {hint ? <p className="muted">{hint}</p> : null}
      {action ? <div style={{ marginTop: '0.75rem' }}>{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {hint ? (
        <span className="field__hint" id={`${htmlFor}-hint`}>
          {hint}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="field__error" id={`${htmlFor}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

const ACTIVITY_TONE: Record<ActivityStatus, string> = {
  DRAFT: 'tag',
  PENDING_REVIEW: 'tag tag--ochre',
  PUBLISHED: 'tag tag--green',
  REJECTED: 'tag tag--danger',
  ARCHIVED: 'tag',
};

export function StatusTag({ status }: { status: ActivityStatus }) {
  const { t } = useI18n();
  return <span className={ACTIVITY_TONE[status]}>{t(`status.${status}`)}</span>;
}

export function VisibilityTag({ visibility }: { visibility: VisibilityLevel }) {
  const { t } = useI18n();
  return (
    <span className={visibility === 'PUBLIC' ? 'tag tag--info' : 'tag'}>
      {t(`visibility.${visibility}`)}
    </span>
  );
}

export function ConsentTag({ status }: { status: ConsentStatus | null }) {
  const { t } = useI18n();
  if (status === 'GRANTED')
    return <span className="tag tag--green">{t('consent.status.GRANTED')}</span>;
  if (status === 'DENIED')
    return <span className="tag tag--danger">{t('consent.status.DENIED')}</span>;
  if (status === 'REVOKED')
    return <span className="tag tag--danger">{t('consent.status.REVOKED')}</span>;
  return <span className="tag tag--ochre">{t('consent.status.NONE')}</span>;
}

export function VerificationTag({ status }: { status: VerificationStatus }) {
  const { t } = useI18n();
  const tone =
    status === 'VERIFIED'
      ? 'tag tag--green'
      : status === 'REJECTED'
        ? 'tag tag--danger'
        : 'tag tag--ochre';
  return <span className={tone}>{t(`verification.${status}`)}</span>;
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  );
}

/** A proportion, shown as a bar rather than a chart library. */
export function RateBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="stat">
      <div className="stat__value">{percent}%</div>
      <div className="stat__label" style={{ marginBottom: '0.4rem' }}>
        {label}
      </div>
      <div
        className="bar"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
