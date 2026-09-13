import { useState } from 'react';
import type { WaitingBoard, WaitingItem } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
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
 * Who is holding this, and for how long.
 *
 * This is the only screen in the product that exists to tell a teacher that
 * somebody else owes them something, and it is there because of a specific,
 * documented failure. When Uttar Pradesh made digital attendance compulsory in
 * July 2024, around 2 per cent of six lakh teachers complied on day one and the
 * order was withdrawn within a fortnight. The objection the unions put first
 * was not that they were being measured — it was that only they were.
 *
 * A platform that puts a head teacher, a block officer and a district officer
 * in the path of a teacher's work, and times only the teacher, would earn
 * exactly the same reception. So the clock here belongs to whoever owes the
 * answer, and an officer opening this page sees their own backlog before
 * anybody else's.
 *
 * Two restraints, both load-bearing. It names the office and never the
 * individual, because an officer measured by name clears work without reading
 * it — which is the failure a gate exists to prevent. And being late has no
 * consequence anywhere: no notice, no report, no counter. The instrument that
 * failed in 2024 turned a missed window into an absence with a salary
 * deduction, and nothing here converts a delay into a finding against anyone.
 */
export function Waiting() {
  const { t, d } = useI18n();
  const { data, error, loading, reload, offline } = useApi<WaitingBoard>('/v1/waiting');
  const [answering, setAnswering] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) {
    return (
      <ErrorNotice message={offline ? t('error.offline') : describe(error, '')} onRetry={reload} />
    );
  }

  return (
    <>
      <PageHeading title={t('waiting.title')} subtitle={t('waiting.intro')} />

      {data.total === 0 ? (
        <EmptyState icon="✅" title={t('waiting.nothing')} />
      ) : (
        <>
          <Card>
            <div className="row" style={{ gap: '1.5rem' }}>
              {/* The officer's own debt, first. For a teacher this reads zero,
                  which is the point: the same screen means the same thing to
                  both of them. */}
              <Stat value={String(data.owedByYou)} label={t('waiting.owedByYou')} />
              <Stat value={`${data.oldestDays} ${t('waiting.days')}`} label={t('waiting.oldest')} />
            </div>
            <p className="faint" style={{ marginBottom: 0 }}>
              {t('waiting.noPenalty')}
            </p>
          </Card>

          <div className="stack">
            {data.items.map((item) => (
              <WaitingRow
                key={`${item.kind}:${item.id}`}
                item={item}
                answering={answering === item.id}
                onAnswer={() => setAnswering(item.id)}
                onDone={() => {
                  setAnswering(null);
                  reload();
                }}
                formatDate={d}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function WaitingRow({
  item,
  answering,
  onAnswer,
  onDone,
  formatDate,
}: {
  item: WaitingItem;
  answering: boolean;
  onAnswer: () => void;
  onDone: () => void;
  formatDate: (value: string) => string;
}) {
  const { t } = useI18n();
  const { may } = useAuth();

  // Only the office that owes the answer is offered the button. A head teacher
  // looking at their own committee's request sees the request and no way to
  // close it, which is correct: answering it is not theirs to do.
  const canAnswer = item.kind === 'SMC_REQUEST' && may('activity:clear');

  return (
    <div className="need">
      <div className="row">
        <span className="tag">{t(`waiting.kind.${item.kind}`)}</span>
        <span className="tag tag--info">{t(`waiting.stage.${item.stage}`)}</span>
        {item.overdue ? <span className="tag tag--ochre">{t('waiting.overdue')}</span> : null}
      </div>
      <p style={{ fontWeight: 600, margin: '0.4rem 0 0.2rem' }}>{item.title}</p>
      <p className="faint" style={{ margin: 0 }}>
        {item.holder} · {item.waitingDays} {t('waiting.days')} · {formatDate(item.waitingSince)}
      </p>
      {item.schoolName !== item.holder ? (
        <p className="faint" style={{ margin: '0.2rem 0 0' }}>
          {item.schoolName}
        </p>
      ) : null}

      {canAnswer ? (
        answering ? (
          <AnswerForm id={item.id} onDone={onDone} />
        ) : (
          <button type="button" className="btn btn--ghost btn--small" onClick={onAnswer}>
            {t('waiting.answer')}
          </button>
        )
      ) : null}
    </div>
  );
}

function AnswerForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState('');
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
          .post(`/v1/smc-meetings/${id}/answer`, { answer })
          .then(onDone)
          .catch((cause: unknown) => setError(describe(cause, t('error.generic'))))
          .finally(() => setBusy(false));
      }}
    >
      <Field
        label={t('waiting.answerLabel')}
        hint={t('waiting.answerHint')}
        htmlFor={`answer-${id}`}
      >
        <textarea
          id={`answer-${id}`}
          rows={3}
          required
          minLength={10}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
      </Field>
      {error ? <ErrorNotice message={error} /> : null}
      <button type="submit" className="btn btn--primary btn--small" disabled={busy}>
        {busy ? <span className="spinner" aria-hidden="true" /> : null}
        {t('waiting.answer')}
      </button>
    </form>
  );
}
