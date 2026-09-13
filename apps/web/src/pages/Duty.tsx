import { useState } from 'react';
import { DUTY_CATEGORIES, type DutyRecord, type DutySummary } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import type { TranslationKey } from '../i18n/strings.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../state/auth.js';
import { api } from '../api/client.js';
import {
  Card,
  EmptyState,
  ErrorNotice,
  Field,
  PageHeading,
  Spinner,
  Stat,
} from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * Teaching days the state's own demands consumed.
 *
 * The feature the teachers' associations asked for themselves: at the
 * department's committee on digital attendance in November 2025 the unions
 * tabled twelve conditions, and the first was release from non-academic work.
 * Eleven of the twelve were about workload and entitlement. Nothing in the
 * whole exchange was about children's learning, which is where the unmet need
 * actually is.
 *
 * Three things about this screen are deliberate and easy to undo by accident.
 *
 * Nothing here nags. No reminder, no badge, no empty-state scolding, no
 * consequence for a teacher who never opens it. Teachers in this state have
 * died under the reporting pressure of the electoral-roll revision, and this
 * arrives on a phone already carrying Prerna, Prerna DBT, SHARDA, Manav
 * Sampada, the mid-day meal line and the census app.
 *
 * It says out loud, on the page, that no officer above the school ever sees a
 * name against these days. A promise made only in the API is not reassurance.
 *
 * And it shows the honorarium alongside the days, because this is the one
 * instrument in the teacher's life that returns something for being filled in
 * — the record that counts what was taken also counts what is owed.
 */
export function Duty() {
  const { t } = useI18n();
  const { may } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [adding, setAdding] = useState(false);

  const list = useApi<DutyRecord[]>('/v1/duties', [nonce]);
  const summary = useApi<DutySummary>('/v1/duties/summary', [nonce]);

  if (list.loading) return <Spinner />;
  if (list.error) {
    return (
      <ErrorNotice
        message={list.offline ? t('error.offline') : describe(list.error, '')}
        onRetry={list.reload}
      />
    );
  }

  const rows = list.data ?? [];
  const totals = summary.data;

  return (
    <>
      <PageHeading title={t('duty.title')} subtitle={t('duty.intro')} />

      <div className="notice">{t('duty.voluntary')}</div>

      {totals && totals.teachingDaysLost > 0 ? (
        <Card>
          <div className="row" style={{ gap: '1.5rem' }}>
            <Stat value={String(totals.teachingDaysLost)} label={t('duty.daysTotal')} />
            <Stat value={String(totals.section27Days)} label={t('duty.daysSection27')} />
            <Stat value={String(totals.otherDays)} label={t('duty.daysOther')} />
            <Stat
              value={String(totals.duringSchoolHoursDays)}
              label={t('duty.daysInSchoolHours')}
            />
          </div>
          {totals.honorarium.outstandingRupees > 0 ? (
            <p style={{ margin: '0.5rem 0 0' }}>
              {t('duty.outstanding')}: <strong>₹{totals.honorarium.outstandingRupees}</strong>
            </p>
          ) : null}
          <p className="faint" style={{ marginBottom: 0 }}>
            {t('duty.section27Note')}
          </p>
        </Card>
      ) : null}

      {may('duty:write') ? (
        adding ? (
          <Card>
            <DutyForm
              onDone={() => {
                setAdding(false);
                setNonce((n) => n + 1);
              }}
            />
          </Card>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            {t('duty.add')}
          </button>
        )
      ) : null}

      {rows.length === 0 ? (
        <EmptyState icon="📋" title={t('duty.empty')} />
      ) : (
        <div className="stack">
          {rows.map((row) => (
            <DutyRow key={row.id} row={row} onChanged={() => setNonce((n) => n + 1)} />
          ))}
        </div>
      )}
    </>
  );
}

function DutyRow({ row, onChanged }: { row: DutyRecord; onChanged: () => void }) {
  const { t, d } = useI18n();
  const { may } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <div className="need">
      <div className="row">
        <span className="tag">{t(`duty.cat.${row.category}` as TranslationKey)}</span>
        <span className={row.section27 ? 'tag tag--info' : 'tag tag--ochre'}>
          {row.section27 ? t('duty.section27') : t('duty.notSection27')}
        </span>
        {row.attestedAt ? <span className="tag tag--green">{t('duty.attested')}</span> : null}
      </div>
      <p style={{ fontWeight: 600, margin: '0.4rem 0 0.2rem' }}>{row.description}</p>
      <p className="faint" style={{ margin: 0 }}>
        {d(row.fromDate)} – {d(row.toDate)} · {row.teachingDaysLost} {t('duty.daysTotal')}
        {row.duringSchoolHours ? ` · ${t('duty.daysInSchoolHours')}` : ''}
        {row.teacherName ? ` · ${row.teacherName}` : ''}
      </p>
      {row.orderReference ? (
        <p className="faint" style={{ margin: '0.2rem 0 0' }}>
          {t('duty.orderReference')}: {row.orderReference}
        </p>
      ) : null}
      {row.honorariumDueRupees !== null ? (
        <p className="faint" style={{ margin: '0.2rem 0 0' }}>
          {t('duty.honorariumDue')} ₹{row.honorariumDueRupees} · {t('duty.honorariumReceived')} ₹
          {row.honorariumReceivedRupees ?? 0}
        </p>
      ) : null}
      {row.attestedByName ? (
        <p className="faint" style={{ margin: '0.2rem 0 0' }}>
          {t('duty.attestedBy')}: {row.attestedByName}
        </p>
      ) : null}

      {/* The head teacher confirms a colleague's record; the API refuses one's
          own, so the button is not offered for it either. */}
      {!row.attestedAt && may('activity:moderate') && row.teacherName ? (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            api
              .post(`/v1/duties/${row.id}/attest`)
              .then(onChanged)
              .finally(() => setBusy(false));
          }}
        >
          {t('duty.attest')}
        </button>
      ) : null}
    </div>
  );
}

function DutyForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: 'ELECTION' as (typeof DUTY_CATEGORIES)[number],
    description: '',
    orderReference: '',
    fromDate: '',
    toDate: '',
    teachingDaysLost: '',
    duringSchoolHours: false,
    honorariumDueRupees: '',
    honorariumReceivedRupees: '',
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const optionalNumber = (value: string) =>
    value.trim() === '' ? undefined : Number.parseInt(value, 10);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        api
          .post('/v1/duties', {
            category: form.category,
            description: form.description,
            orderReference: form.orderReference.trim() || undefined,
            fromDate: form.fromDate,
            toDate: form.toDate,
            teachingDaysLost: Number.parseInt(form.teachingDaysLost, 10),
            duringSchoolHours: form.duringSchoolHours,
            honorariumDueRupees: optionalNumber(form.honorariumDueRupees),
            honorariumReceivedRupees: optionalNumber(form.honorariumReceivedRupees),
          })
          .then(onDone)
          .catch((cause: unknown) => setError(describe(cause, t('error.generic'))))
          .finally(() => setBusy(false));
      }}
    >
      <Field label={t('duty.category')} htmlFor="duty-category">
        <select
          id="duty-category"
          value={form.category}
          onChange={(event) =>
            set('category', event.target.value as (typeof DUTY_CATEGORIES)[number])
          }
        >
          {DUTY_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(`duty.cat.${category}` as TranslationKey)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('duty.description')} hint={t('duty.descriptionHint')} htmlFor="duty-what">
        <input
          id="duty-what"
          required
          minLength={4}
          maxLength={200}
          value={form.description}
          onChange={(event) => set('description', event.target.value)}
        />
      </Field>

      <Field
        label={t('duty.orderReference')}
        hint={t('duty.orderReferenceHint')}
        htmlFor="duty-order"
      >
        <input
          id="duty-order"
          maxLength={120}
          value={form.orderReference}
          onChange={(event) => set('orderReference', event.target.value)}
        />
      </Field>

      <div className="row">
        <Field label={t('duty.fromDate')} htmlFor="duty-from">
          <input
            id="duty-from"
            type="date"
            required
            value={form.fromDate}
            onChange={(event) => set('fromDate', event.target.value)}
          />
        </Field>
        <Field label={t('duty.toDate')} htmlFor="duty-to">
          <input
            id="duty-to"
            type="date"
            required
            value={form.toDate}
            onChange={(event) => set('toDate', event.target.value)}
          />
        </Field>
      </div>

      <Field label={t('duty.daysLost')} hint={t('duty.daysLostHint')} htmlFor="duty-days">
        <input
          id="duty-days"
          type="number"
          inputMode="numeric"
          min={0}
          max={200}
          required
          value={form.teachingDaysLost}
          onChange={(event) => set('teachingDaysLost', event.target.value)}
        />
      </Field>

      <Field
        label={t('duty.duringSchoolHours')}
        hint={t('duty.duringSchoolHoursHint')}
        htmlFor="duty-hours"
      >
        <input
          id="duty-hours"
          type="checkbox"
          checked={form.duringSchoolHours}
          onChange={(event) => set('duringSchoolHours', event.target.checked)}
        />
      </Field>

      <div className="row">
        <Field label={t('duty.honorariumDue')} hint={t('duty.honorariumHint')} htmlFor="duty-due">
          <input
            id="duty-due"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.honorariumDueRupees}
            onChange={(event) => set('honorariumDueRupees', event.target.value)}
          />
        </Field>
        <Field label={t('duty.honorariumReceived')} htmlFor="duty-got">
          <input
            id="duty-got"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.honorariumReceivedRupees}
            onChange={(event) => set('honorariumReceivedRupees', event.target.value)}
          />
        </Field>
      </div>

      {error ? <ErrorNotice message={error} /> : null}
      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        {t('duty.add')}
      </button>
    </form>
  );
}
