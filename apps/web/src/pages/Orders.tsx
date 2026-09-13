import { useState } from 'react';
import {
  BLOCKED_REASONS,
  RESPONSE_STATES,
  type AuthenticityResult,
  type BlockedReason,
  type Directive,
  type ResponseState,
} from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import type { TranslationKey } from '../i18n/strings.js';
import { useApi } from '../lib/useApi.js';
import { api } from '../api/client.js';
import { Card, EmptyState, ErrorNotice, Field, PageHeading, Spinner } from '../components/ui.js';
import { describe } from './SignIn.js';

/**
 * What the state has actually asked of this school, and whether the letter in
 * your hand is real.
 *
 * A UP basic education order is addressed to District Basic Shiksha Adhikaris,
 * never to a school, and reaches the classroom through WhatsApp groups the
 * state project office itself instituted — no addressing, no versioning, no
 * acknowledgement. Forged orders bearing officers' signatures travel the same
 * pipe. A Block Education Officer in Bareilly once ordered every school to
 * supply 46 kg of fodder under threat of departmental action, and the
 * correction mechanism was viral outrage.
 *
 * So the check comes first on the page, above the list. It is the only thing
 * here that is purely a service to the reader with no measurement in it at all,
 * and it is what a head teacher will open this screen for.
 *
 * The wording of a miss matters more than anything else on the page: "not on
 * the register" and never "false". The register holds what has been published
 * to it, which is a subset of what exists, and a platform that told a head
 * teacher a genuine order was fake would do more harm in one afternoon than
 * this saves in a year.
 */
export function Orders() {
  const { t } = useI18n();
  const [nonce, setNonce] = useState(0);
  const { data, error, loading, reload, offline } = useApi<Directive[]>('/v1/directives', [nonce]);

  return (
    <>
      <PageHeading title={t('order.title')} subtitle={t('order.intro')} />

      <AuthenticityCheck />

      {loading ? <Spinner /> : null}
      {error ? (
        <ErrorNotice
          message={offline ? t('error.offline') : describe(error, '')}
          onRetry={reload}
        />
      ) : null}

      {data && data.length === 0 ? <EmptyState icon="📭" title={t('order.empty')} /> : null}

      <div className="stack">
        {(data ?? []).map((directive) => (
          <OrderCard
            key={directive.id}
            directive={directive}
            onAnswered={() => setNonce((n) => n + 1)}
          />
        ))}
      </div>
    </>
  );
}

function AuthenticityCheck() {
  const { t, d } = useI18n();
  const [letterNumber, setLetterNumber] = useState('');
  const [result, setResult] = useState<AuthenticityResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <h2>{t('order.checkTitle')}</h2>
      <p className="muted">{t('order.checkIntro')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          setResult(null);
          api
            .get<AuthenticityResult>(
              `/v1/directives/check?letterNumber=${encodeURIComponent(letterNumber)}`,
            )
            .then(setResult)
            .catch((cause: unknown) => setError(describe(cause, t('error.generic'))))
            .finally(() => setBusy(false));
        }}
      >
        <Field label={t('order.checkLabel')} htmlFor="check-letter">
          <input
            id="check-letter"
            required
            maxLength={120}
            value={letterNumber}
            onChange={(event) => setLetterNumber(event.target.value)}
          />
        </Field>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {t('order.check')}
        </button>
      </form>

      {error ? <ErrorNotice message={error} /> : null}

      {result ? (
        result.found ? (
          <div className="notice notice--success" style={{ marginTop: '0.75rem' }}>
            <strong>{t('order.checkFound')}</strong>
            {result.matches.map((match) => (
              <p key={match.id} style={{ margin: '0.4rem 0 0' }}>
                {match.title} · {t(`order.src.${match.source}` as TranslationKey)} ·{' '}
                {match.issuingOffice} · {d(match.issuedOn)}
                {match.supersededById ? (
                  <>
                    <br />
                    <strong>{t('order.checkSuperseded')}</strong>
                  </>
                ) : null}
              </p>
            ))}
          </div>
        ) : (
          // Never "this is forged". The register is a subset of what exists.
          <div className="notice notice--warn" style={{ marginTop: '0.75rem' }}>
            {t('order.checkNotFound')}
          </div>
        )
      ) : null}
    </Card>
  );
}

function OrderCard({ directive, onAnswered }: { directive: Directive; onAnswered: () => void }) {
  const { t, d } = useI18n();
  const [answering, setAnswering] = useState(false);

  return (
    <Card>
      <div className="row">
        {/* The rank the instruction actually carries. Orders reach a school
            today with none, so a court direction and a block officer's
            improvisation look identical on a phone. */}
        <span className={directive.source === 'BLOCK_INSTRUCTION' ? 'tag' : 'tag tag--info'}>
          {t(`order.src.${directive.source}` as TranslationKey)}
        </span>
        {directive.dueBy ? (
          <span className="tag tag--ochre">
            {t('order.dueBy')} {d(directive.dueBy)}
          </span>
        ) : null}
        {directive.myResponse ? (
          <span className="tag tag--green">
            {t(`order.state.${directive.myResponse.state}` as TranslationKey)}
          </span>
        ) : null}
      </div>

      <h2 style={{ marginBottom: '0.3rem' }}>{directive.title}</h2>
      <p className="faint" style={{ margin: 0 }}>
        {t('order.letterNumber')}: {directive.letterNumber} · {directive.issuingOffice} ·{' '}
        {d(directive.issuedOn)}
      </p>

      {/* Mandatory and separate from the order's own text. A shasanadesh is
          drafted for an officer, not as a task for a head teacher, and with
          roughly one academic support person per thirty schools nothing
          arrives explained. */}
      <h3 style={{ marginBottom: '0.2rem' }}>{t('order.plainSummary')}</h3>
      <p style={{ whiteSpace: 'pre-wrap', marginTop: 0 }}>{directive.plainSummary}</p>

      {directive.documentUrl ? (
        <p className="faint">
          <a href={directive.documentUrl} target="_blank" rel="noreferrer noopener">
            {t('order.document')}
          </a>
        </p>
      ) : null}

      {directive.myResponse ? (
        <p className="faint" style={{ marginBottom: '0.4rem' }}>
          {t('order.myAnswer')}:{' '}
          <strong>{t(`order.state.${directive.myResponse.state}` as TranslationKey)}</strong>
          {directive.myResponse.blockedReason ? (
            <>
              {' — '}
              {t(`order.blocked.${directive.myResponse.blockedReason}` as TranslationKey)}
            </>
          ) : null}
          {' · '}
          {t('order.answeredBy')}: {directive.myResponse.respondedByName}
        </p>
      ) : null}

      {answering ? (
        <AnswerForm
          id={directive.id}
          onDone={() => {
            setAnswering(false);
            onAnswered();
          }}
        />
      ) : (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => setAnswering(true)}
        >
          {t('order.respond')}
        </button>
      )}
    </Card>
  );
}

function AnswerForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<ResponseState>('SEEN');
  const [blockedReason, setBlockedReason] = useState<BlockedReason>('FUNDS_NOT_RECEIVED');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      style={{ marginTop: '0.6rem' }}
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        api
          .post(`/v1/directives/${id}/respond`, {
            state,
            // Only ever sent against a blocked answer: the API rejects it
            // anywhere else, deliberately, so the field cannot drift into a
            // general-purpose explanation box an officer reads.
            blockedReason: state === 'BLOCKED' ? blockedReason : undefined,
            note: note.trim() || undefined,
          })
          .then(onDone)
          .catch((cause: unknown) => setError(describe(cause, t('error.generic'))))
          .finally(() => setBusy(false));
      }}
    >
      <Field label={t('order.myAnswer')} htmlFor={`state-${id}`}>
        <select
          id={`state-${id}`}
          value={state}
          onChange={(event) => setState(event.target.value as ResponseState)}
        >
          {RESPONSE_STATES.map((option) => (
            <option key={option} value={option}>
              {t(`order.state.${option}` as TranslationKey)}
            </option>
          ))}
        </select>
      </Field>

      {state === 'BLOCKED' ? (
        <Field
          label={t('order.whatIsMissing')}
          hint={t('order.blockedHelp')}
          htmlFor={`blocked-${id}`}
        >
          <select
            id={`blocked-${id}`}
            value={blockedReason}
            onChange={(event) => setBlockedReason(event.target.value as BlockedReason)}
          >
            {BLOCKED_REASONS.map((option) => (
              <option key={option} value={option}>
                {t(`order.blocked.${option}` as TranslationKey)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label={t('order.noteOptional')} htmlFor={`note-${id}`}>
        <textarea
          id={`note-${id}`}
          rows={2}
          maxLength={600}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      {error ? <ErrorNotice message={error} /> : null}
      <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        {t('order.respond')}
      </button>
    </form>
  );
}
