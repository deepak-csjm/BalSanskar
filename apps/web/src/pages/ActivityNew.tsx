import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ACTIVITY_CATEGORIES,
  CLASS_LEVELS,
  MAX_UPLOAD_BYTES,
  type ClassLevel,
  type ActivityDetail,
  type Student,
  type UploadTicket,
} from '@balsanskar/shared';
import { NetworkError, api, uploadToTicket } from '../api/client.js';
import { useI18n } from '../i18n/index.js';
import { useApi, type PagedResponse } from '../lib/useApi.js';
import { compressImage, formatBytes } from '../lib/image.js';
import { perceptualHash } from '../lib/phash.js';
import { enqueueActivity } from '../offline/outbox.js';
import { Card, ErrorNotice, Field, PageHeading } from '../components/ui.js';
import { describe } from './SignIn.js';
import { CATEGORY_LABELS } from '../lib/labels.js';

/**
 * Recording an activity — the screen this platform lives or dies by.
 *
 * Design constraints that shaped it:
 *   - a teacher fills this in during a five-minute gap, often standing up;
 *   - photographs come straight from the camera at 5 MB and must be shrunk
 *     before they touch the network;
 *   - the network is frequently absent, so the form must never lose work.
 *
 * The last point is why submitting falls back to the offline outbox rather than
 * showing an error. A teacher who loses a write-up once does not come back.
 */
export function ActivityNew() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'CLASSROOM_INNOVATION' as (typeof ACTIVITY_CATEGORIES)[number],
    occurredOn: new Date().toISOString().slice(0, 10),
    participantCount: '',
    learningOutcome: '',
  });
  const [classLevels, setClassLevels] = useState<ClassLevel[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<
    Array<{ blob: Blob; url: string; name: string; hash: string | null }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [queuedNotice, setQueuedNotice] = useState(false);

  const roster = useApi<PagedResponse<Student>>('/v1/students?limit=100');

  // Object URLs are a leak if they are not revoked; on a low-memory phone with
  // several 2 MB previews that matters.
  useEffect(() => {
    return () => {
      for (const photo of photos) URL.revokeObjectURL(photo.url);
    };
  }, [photos]);

  const payload = useMemo(
    () => ({
      title: form.title,
      description: form.description,
      category: form.category,
      occurredOn: form.occurredOn,
      classLevels,
      studentIds,
      tags: [],
      ...(form.participantCount ? { participantCount: Number(form.participantCount) } : {}),
      ...(form.learningOutcome ? { learningOutcome: form.learningOutcome } : {}),
    }),
    [classLevels, form, studentIds],
  );

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    const accepted: typeof photos = [];
    for (const file of Array.from(files).slice(0, 10 - photos.length)) {
      const blob = await compressImage(file);
      if (blob.size > MAX_UPLOAD_BYTES) {
        setError(`${file.name}: ${formatBytes(blob.size)} — too large even after compression.`);
        continue;
      }
      // Fingerprinted here, before compression is forgotten and while the
      // phone still holds the bytes — the server never sees them. A browser
      // that cannot manage it returns null, which is not an error.
      const hash = await perceptualHash(blob);
      accepted.push({ blob, url: URL.createObjectURL(blob), name: file.name, hash });
    }
    setPhotos((current) => [...current, ...accepted]);
  };

  const removePhoto = (index: number) => {
    setPhotos((current) => {
      const photo = current[index];
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((_, position) => position !== index);
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const mediaKeys: string[] = [];
      for (const photo of photos) {
        const ticket = await api.post<UploadTicket>('/v1/uploads', {
          fileName: photo.name,
          contentType: photo.blob.type === 'image/png' ? 'image/png' : 'image/jpeg',
          sizeBytes: photo.blob.size,
          purpose: 'ACTIVITY_MEDIA',
          ...(photo.hash ? { perceptualHash: photo.hash } : {}),
        });
        await uploadToTicket(ticket, photo.blob);
        mediaKeys.push(ticket.key);
      }
      const created = await api.post<ActivityDetail>('/v1/activities', { ...payload, mediaKeys });
      navigate(`/app/activities/${created.id}`, { replace: true });
    } catch (caught) {
      if (caught instanceof NetworkError) {
        // The network went away mid-submit. Keep the work.
        await enqueueActivity(
          payload,
          photos.map((photo) => photo.blob),
        );
        setQueuedNotice(true);
        setBusy(false);
        return;
      }
      if (caught && typeof caught === 'object' && 'fields' in caught) {
        setFieldErrors((caught as { fields?: Record<string, string[]> }).fields ?? {});
      }
      setError(describe(caught, t('error.generic')));
    } finally {
      setBusy(false);
    }
  };

  if (queuedNotice) {
    return (
      <Card>
        <p className="notice notice--warn">{t('activity.savedOffline')}</p>
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => navigate('/app')}
        >
          {t('action.continue')}
        </button>
      </Card>
    );
  }

  return (
    <>
      <PageHeading title={t('action.newActivity')} />
      <Card>
        <form onSubmit={submit} noValidate>
          <Field
            label={t('activity.title')}
            hint={t('activity.titleHint')}
            error={fieldErrors.title?.[0]}
            htmlFor="title"
          >
            <input
              id="title"
              type="text"
              required
              maxLength={160}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              aria-invalid={Boolean(fieldErrors.title)}
            />
          </Field>

          <Field
            label={t('activity.description')}
            hint={t('activity.descriptionHint')}
            error={fieldErrors.description?.[0]}
            htmlFor="description"
          >
            <textarea
              id="description"
              required
              maxLength={5000}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              aria-invalid={Boolean(fieldErrors.description)}
            />
          </Field>

          <Field label={t('activity.category')} htmlFor="category">
            <select
              id="category"
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value as typeof form.category })
              }
            >
              {ACTIVITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS.hi[category]} / {CATEGORY_LABELS.en[category]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={t('activity.date')}
            error={fieldErrors.occurredOn?.[0]}
            htmlFor="occurredOn"
          >
            <input
              id="occurredOn"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
              value={form.occurredOn}
              onChange={(event) => setForm({ ...form, occurredOn: event.target.value })}
              aria-invalid={Boolean(fieldErrors.occurredOn)}
            />
          </Field>

          <fieldset>
            <legend>{t('activity.classes')}</legend>
            <div className="row">
              {CLASS_LEVELS.map((level) => (
                <label key={level} className="checkline" style={{ marginInlineEnd: '0.75rem' }}>
                  <input
                    type="checkbox"
                    checked={classLevels.includes(level)}
                    onChange={(event) =>
                      setClassLevels((current) =>
                        event.target.checked
                          ? [...current, level]
                          : current.filter((entry) => entry !== level),
                      )
                    }
                  />
                  <span>{level === 'BALVATIKA' ? 'बालवाटिका' : level}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Field label={t('activity.participants')} htmlFor="participantCount">
            <input
              id="participantCount"
              type="number"
              inputMode="numeric"
              min={0}
              max={5000}
              value={form.participantCount}
              onChange={(event) => setForm({ ...form, participantCount: event.target.value })}
            />
          </Field>

          <Field label={t('activity.photos')} htmlFor="photos">
            <input
              id="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              // `capture` is deliberately omitted: a teacher often wants a photo
              // taken earlier in the day, not one taken right now.
              onChange={(event) => void addPhotos(event.target.files)}
            />
            <span className="field__hint">{t('activity.photoHint')}</span>
          </Field>

          {photos.length > 0 ? (
            <div className="thumbs" style={{ marginBottom: '1rem' }}>
              {photos.map((photo, index) => (
                <div className="thumb" key={photo.url}>
                  <img src={photo.url} alt={photo.name} />
                  <button
                    type="button"
                    className="thumb__remove"
                    onClick={() => removePhoto(index)}
                    aria-label={`${t('action.remove')} ${photo.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {roster.data && roster.data.items.length > 0 ? (
            <fieldset>
              <legend>{t('activity.students')}</legend>
              <p className="field__hint">{t('consent.explain')}</p>
              <div className="stack">
                {roster.data.items.map((student) => (
                  <label key={student.id} className="checkline">
                    <input
                      type="checkbox"
                      checked={studentIds.includes(student.id)}
                      onChange={(event) =>
                        setStudentIds((current) =>
                          event.target.checked
                            ? [...current, student.id]
                            : current.filter((entry) => entry !== student.id),
                        )
                      }
                    />
                    <span>
                      {student.fullName}{' '}
                      <span className="faint">
                        ({student.classLevel})
                        {student.mediaConsent !== 'GRANTED' ? ' · सहमति दर्ज नहीं' : ''}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <Field label={t('activity.learningOutcome')} htmlFor="learningOutcome">
            <textarea
              id="learningOutcome"
              maxLength={1000}
              style={{ minHeight: '5rem' }}
              value={form.learningOutcome}
              onChange={(event) => setForm({ ...form, learningOutcome: event.target.value })}
            />
          </Field>

          {error ? <ErrorNotice message={error} /> : null}

          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={busy || form.title.length < 5 || form.description.length < 20}
          >
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {t('action.saveDraft')}
          </button>
        </form>
      </Card>
    </>
  );
}
