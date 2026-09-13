import { useEffect, useState, type FormEvent } from 'react';
import { CLASS_LEVELS, type ClassLevel, type Enrolment as EnrolmentType } from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { useApi } from '../lib/useApi.js';
import { Card, ErrorNotice, Field, PageHeading, Spinner, Stat } from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * The school's register: how many children in each class, and nothing else.
 *
 * This screen replaced a roster of named children with guardian contacts and a
 * consent slip per child. That screen was the most resented thing in the
 * product — a head teacher typing in two hundred children, keeping them
 * current, chasing signatures, and seeing nothing come back for it — and it was
 * the platform's entire legal exposure under the children's-data provisions of
 * the DPDP Act. See docs/data-protection.md.
 *
 * What the platform actually needed from all of that was a denominator: enough
 * to notice a school reporting four hundred participants when it teaches
 * ninety. That is nine numbers, entered once a term.
 */
export function Enrolment() {
  const { t, d } = useI18n();
  const { user } = useAuth();
  const schoolId = user?.schoolId ?? null;
  const { data, error, loading, reload, offline } = useApi<EnrolmentType>(
    schoolId ? `/v1/schools/${schoolId}/enrolment` : null,
    [schoolId],
  );

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [asOn, setAsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const row of data.classes) next[row.classLevel] = String(row.enrolled);
    setCounts(next);
    if (data.asOn) setAsOn(data.asOn);
  }, [data]);

  if (!schoolId) return <ErrorNotice message={t('error.forbidden')} />;
  if (loading) return <Spinner />;
  if (error && !data) {
    return (
      <ErrorNotice message={offline ? t('error.offline') : t('error.generic')} onRetry={reload} />
    );
  }

  const total = Object.values(counts).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    setSaved(false);
    try {
      // Classes left blank are classes the school does not run, so they are
      // omitted rather than sent as zero. A whole-form replace on the server
      // then removes any that have gone.
      const classes = CLASS_LEVELS.filter((level) => counts[level]?.trim()).map((level) => ({
        classLevel: level,
        enrolled: Number(counts[level]),
      }));
      await api.put(`/v1/schools/${schoolId}/enrolment`, { classes, asOn });
      setSaved(true);
      reload();
    } catch (caught) {
      setActionError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeading title={t('enrolment.title')} subtitle={t('enrolment.intro')} />

      <Card>
        <div className="row" style={{ gap: '1.5rem' }}>
          <Stat value={String(total)} label={t('enrolment.total')} />
          {data?.asOn ? <Stat value={d(data.asOn)} label={t('enrolment.asOn')} /> : null}
        </div>
        {data?.updatedByName ? (
          <p className="faint" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            {t('enrolment.updatedBy')}: {data.updatedByName}
          </p>
        ) : null}
      </Card>

      <Card>
        <form onSubmit={submit} noValidate>
          <p className="muted">{t('enrolment.hint')}</p>
          <div className="enrolment-grid">
            {CLASS_LEVELS.map((level) => (
              <Field
                key={level}
                label={t(`class.${level as ClassLevel}`)}
                htmlFor={`enrol-${level}`}
              >
                <input
                  id={`enrol-${level}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={counts[level] ?? ''}
                  placeholder="—"
                  onChange={(event) =>
                    setCounts((current) => ({
                      ...current,
                      [level]: event.target.value.replace(/\D/g, ''),
                    }))
                  }
                />
              </Field>
            ))}
          </div>

          <Field
            label={t('enrolment.asOnLabel')}
            hint={t('enrolment.asOnHint')}
            htmlFor="enrolAsOn"
          >
            <input
              id="enrolAsOn"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={asOn}
              onChange={(event) => setAsOn(event.target.value)}
            />
          </Field>

          {actionError ? <ErrorNotice message={actionError} /> : null}
          {saved ? <p className="notice notice--success">{t('enrolment.saved')}</p> : null}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {t('action.save')}
          </button>
        </form>

        <p className="faint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          {t('enrolment.privacy')}
        </p>
      </Card>
    </>
  );
}
