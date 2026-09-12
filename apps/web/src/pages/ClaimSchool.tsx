import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  SCHOOL_TYPES,
  type Block,
  type ClaimReceipt,
  type District,
  type RequestOtpResponse,
  type SchoolLookup,
  type SchoolType,
} from '@balsanskar/shared';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { SCHOOL_TYPE_LABELS } from '../lib/labels.js';
import { Card, ErrorNotice, Field, PageHeading, Spinner } from '../components/ui.js';
import { TopBar } from '../components/Shell.js';
import { describe } from './SignIn.js';

/**
 * Claiming a school that is not on the platform yet.
 *
 * Reachable without an account, because by definition the person raising the
 * claim has none. Nothing here creates a school: the claim goes to the block
 * education officer, who is the one person in the chain who already knows which
 * head teacher runs which school. That is the whole design — see
 * docs/integrity.md.
 *
 * The steps are ordered so the expensive ones come last. The UDISE code is
 * checked first, because a school already in the register needs a different
 * screen entirely (registration, not a claim); the one-time code is sent only
 * once everything else has been typed, so a wrong digit in the code costs one
 * retry rather than the whole form.
 */
export function ClaimSchool() {
  const { t } = useI18n();
  const [step, setStep] = useState<'code' | 'details' | 'done'>('code');
  const [udiseCode, setUdiseCode] = useState('');
  const [known, setKnown] = useState<SchoolLookup | null>(null);
  const [receipt, setReceipt] = useState<ClaimReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const checkCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setKnown(null);
    try {
      // A hit here is not a failure: it means the school is already in the
      // register, and the claimant should be told so before typing anything
      // else. A miss is the ordinary case and throws, which is why the lookup
      // failing is swallowed rather than surfaced.
      const found = await api.get<SchoolLookup>(
        `/v1/schools/lookup?udiseCode=${encodeURIComponent(udiseCode)}`,
        { anonymous: true },
      );
      setKnown(found);
      if (!found.isRegistered) setStep('details');
    } catch {
      setStep('details');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <TopBar />
      <main className="main" id="main" style={{ maxWidth: '32rem' }}>
        <PageHeading title={t('claim.title')} subtitle={t('claim.intro')} />

        {step === 'code' ? (
          <Card>
            <p className="muted">{t('claim.whyClaim')}</p>
            <form onSubmit={checkCode} noValidate>
              <Field
                label={t('register.udiseLabel')}
                hint={t('register.udiseHint')}
                htmlFor="claimUdise"
              >
                <input
                  id="claimUdise"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{11}"
                  maxLength={11}
                  required
                  value={udiseCode}
                  onChange={(event) => setUdiseCode(event.target.value.replace(/\D/g, ''))}
                  aria-describedby="claimUdise-hint"
                />
              </Field>

              {known?.isRegistered ? (
                <div className="notice notice--warn">
                  <strong>{known.nameHi}</strong>
                  <br />
                  <span className="muted">
                    {known.blockName} · {known.districtName}
                  </span>
                  <p style={{ margin: '0.5rem 0 0' }}>{t('claim.alreadyOnPlatform')}</p>
                  <p style={{ margin: '0.5rem 0 0' }}>
                    <Link className="btn btn--small" to="/register">
                      {t('action.register')}
                    </Link>
                  </p>
                </div>
              ) : null}

              {error ? <ErrorNotice message={error} /> : null}
              <button
                type="submit"
                className="btn btn--primary btn--block"
                disabled={busy || udiseCode.length !== 11}
              >
                {busy ? <span className="spinner" aria-hidden="true" /> : null}
                {t('action.next')}
              </button>
            </form>
          </Card>
        ) : null}

        {step === 'details' ? (
          <ClaimForm
            udiseCode={udiseCode}
            onDone={(result) => {
              setReceipt(result);
              setStep('done');
            }}
          />
        ) : null}

        {step === 'done' && receipt ? <Receipt receipt={receipt} /> : null}

        <p className="muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/signin">{t('action.back')}</Link>
        </p>
      </main>
    </div>
  );
}

/** District then block, because a block list for the whole state is unusable. */
function ClaimForm({
  udiseCode,
  onDone,
}: {
  udiseCode: string;
  onDone: (receipt: ClaimReceipt) => void;
}) {
  const { t, locale } = useI18n();
  const [districts, setDistricts] = useState<District[] | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [districtId, setDistrictId] = useState('');
  const [form, setForm] = useState({
    blockId: '',
    proposedNameHi: '',
    proposedType: 'PRIMARY' as SchoolType,
    villageOrWard: '',
    claimantName: '',
    claimantDesignation: '',
    claimantEmployeeCode: '',
    phone: '',
  });
  const [sent, setSent] = useState<RequestOtpResponse | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: District[] }>('/v1/districts', { anonymous: true })
      .then((result) => {
        if (!cancelled) setDistricts(result.items);
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!districtId) {
      setBlocks(null);
      return;
    }
    let cancelled = false;
    setBlocks(null);
    api
      .get<{ items: Block[] }>(`/v1/districts/${districtId}/blocks`, { anonymous: true })
      .then((result) => {
        if (!cancelled) setBlocks(result.items);
      })
      .catch(() => {
        if (!cancelled) setBlocks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [districtId]);

  const name = (row: { nameHi: string; nameEn: string }) =>
    locale === 'hi' ? row.nameHi : row.nameEn;

  // The platform rolls out district by district. Loading is not "not open".
  const districtNotOpen = districtId !== '' && blocks !== null && blocks.length === 0;

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
      onDone(
        await api.post<ClaimReceipt>(
          '/v1/school-claims',
          {
            phone: form.phone,
            code,
            udiseCode,
            blockId: form.blockId,
            proposedNameHi: form.proposedNameHi,
            proposedType: form.proposedType,
            claimantName: form.claimantName,
            ...(form.villageOrWard ? { villageOrWard: form.villageOrWard } : {}),
            ...(form.claimantDesignation ? { claimantDesignation: form.claimantDesignation } : {}),
            ...(form.claimantEmployeeCode
              ? { claimantEmployeeCode: form.claimantEmployeeCode }
              : {}),
          },
          { anonymous: true },
        ),
      );
    } catch (caught) {
      if (caught && typeof caught === 'object' && 'fields' in caught) {
        setFieldErrors((caught as { fields?: Record<string, string[]> }).fields ?? {});
      }
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  const ready =
    form.blockId !== '' &&
    form.proposedNameHi.trim().length >= 3 &&
    form.claimantName.trim().length >= 2 &&
    form.phone.replace(/\D/g, '').length >= 10;

  return (
    <Card>
      <p className="notice notice--success" style={{ marginBottom: '1rem' }}>
        UDISE <strong>{udiseCode}</strong>
      </p>

      <form onSubmit={sent ? submit : sendCode} noValidate>
        <Field label={t('claim.district')} htmlFor="claimDistrict">
          {districts === null ? (
            <Spinner />
          ) : (
            <select
              id="claimDistrict"
              required
              value={districtId}
              onChange={(event) => {
                setDistrictId(event.target.value);
                setForm((current) => ({ ...current, blockId: '' }));
              }}
            >
              <option value="">—</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {name(district)}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label={t('claim.block')} error={fieldErrors.blockId?.[0]} htmlFor="claimBlock">
          <select
            id="claimBlock"
            required
            disabled={!districtId || blocks === null}
            value={form.blockId}
            onChange={(event) => setForm({ ...form, blockId: event.target.value })}
          >
            <option value="">—</option>
            {(blocks ?? []).map((block) => (
              <option key={block.id} value={block.id}>
                {name(block)}
              </option>
            ))}
          </select>
        </Field>

        {/* The platform rolls out district by district, so for most of the
            state this list is empty — and an empty dropdown with no
            explanation reads as a broken page rather than as "not yet". */}
        {districtNotOpen ? (
          <div className="notice notice--warn">{t('claim.districtNotOpen')}</div>
        ) : null}

        {!districtNotOpen ? (
          <>
            <Field
              label={t('claim.schoolName')}
              error={fieldErrors.proposedNameHi?.[0]}
              htmlFor="claimName"
            >
              <input
                id="claimName"
                type="text"
                required
                value={form.proposedNameHi}
                onChange={(event) => setForm({ ...form, proposedNameHi: event.target.value })}
                aria-invalid={Boolean(fieldErrors.proposedNameHi)}
              />
            </Field>

            <Field label={t('claim.schoolType')} htmlFor="claimType">
              <select
                id="claimType"
                value={form.proposedType}
                onChange={(event) =>
                  setForm({ ...form, proposedType: event.target.value as SchoolType })
                }
              >
                {SCHOOL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SCHOOL_TYPE_LABELS[locale][type]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('claim.village')} htmlFor="claimVillage">
              <input
                id="claimVillage"
                type="text"
                value={form.villageOrWard}
                onChange={(event) => setForm({ ...form, villageOrWard: event.target.value })}
              />
            </Field>

            <Field
              label={t('claim.yourName')}
              error={fieldErrors.claimantName?.[0]}
              htmlFor="claimantName"
            >
              <input
                id="claimantName"
                type="text"
                autoComplete="name"
                required
                value={form.claimantName}
                onChange={(event) => setForm({ ...form, claimantName: event.target.value })}
                aria-invalid={Boolean(fieldErrors.claimantName)}
              />
            </Field>

            <Field label={t('register.designationLabel')} htmlFor="claimantDesignation">
              <input
                id="claimantDesignation"
                type="text"
                value={form.claimantDesignation}
                onChange={(event) => setForm({ ...form, claimantDesignation: event.target.value })}
              />
            </Field>

            <Field label={t('register.employeeCodeLabel')} htmlFor="claimantEmployeeCode">
              <input
                id="claimantEmployeeCode"
                type="text"
                value={form.claimantEmployeeCode}
                onChange={(event) => setForm({ ...form, claimantEmployeeCode: event.target.value })}
              />
            </Field>

            <Field
              label={t('auth.phoneLabel')}
              hint={t('claim.phoneHint')}
              error={fieldErrors.phone?.[0]}
              htmlFor="claimPhone"
            >
              <input
                id="claimPhone"
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
                <Field label={t('auth.codeLabel')} htmlFor="claimCode">
                  <input
                    id="claimCode"
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
              disabled={busy || !ready || (Boolean(sent) && code.length !== 6)}
            >
              {busy ? <span className="spinner" aria-hidden="true" /> : null}
              {sent ? t('claim.submit') : t('auth.sendCode')}
            </button>
          </>
        ) : null}
      </form>

      <p className="faint" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
        {t('claim.boardPhotoHint')}
      </p>
    </Card>
  );
}

/**
 * What the claimant is told afterwards.
 *
 * The collision case matters more than the happy one. Two head teachers at the
 * same school racing to claim it is an ordinary mistake, not an attack, and the
 * second one needs enough to recognise a colleague — a given name and a
 * designation — without the screen becoming a way to enumerate who works where.
 */
function Receipt({ receipt }: { receipt: ClaimReceipt }) {
  const { t, d } = useI18n();

  if (receipt.status === 'ALREADY_CLAIMED') {
    return (
      <Card>
        <div className="notice notice--warn">
          <strong>{t('claim.alreadyClaimed')}</strong>
          {receipt.existingClaimantHint ? (
            <p style={{ margin: '0.5rem 0 0' }}>
              {t('claim.alreadyClaimedBy')}: <strong>{receipt.existingClaimantHint}</strong>
            </p>
          ) : null}
          <p style={{ margin: '0.5rem 0 0' }}>{t('claim.alreadyClaimedHint')}</p>
        </div>
        <p className="muted">
          {receipt.blockName} · {t('claim.block')}
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="notice notice--success">
        <strong>{t('claim.sent')}</strong>
      </p>
      <p>{t('claim.sentDetail')}</p>
      <p className="muted">
        {t('claim.block')}: {receipt.blockName}
      </p>
      {receipt.expiresAt ? (
        <p className="faint" style={{ marginBottom: 0 }}>
          {t('claim.expires')}: {d(receipt.expiresAt)}
        </p>
      ) : null}
    </Card>
  );
}
