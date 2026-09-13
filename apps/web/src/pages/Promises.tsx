import { Link } from 'react-router-dom';
import { FORBIDDEN_FEATURES, GUARANTEE_STATEMENTS } from '@balsanskar/shared';
import { useI18n } from '../i18n/index.js';
import type { TranslationKey } from '../i18n/strings.js';
import { Card, PageHeading } from '../components/ui.js';
import { TopBar } from '../components/Shell.js';

/**
 * The screen a teacher reads before deciding whether to trust this at all.
 *
 * Every digital instrument handed to a UP basic school teacher so far has
 * measured them and returned nothing, and one of them — online attendance with
 * a selfie and a geotag — was ordered in July 2024 and withdrawn inside a
 * fortnight. A teacher arriving here has excellent reasons for suspicion and no
 * reason to take our assurances on faith.
 *
 * So this page does three unusual things. It states the promises in the
 * teacher's own language rather than the platform's. It says, beside each one,
 * *why* the promise exists, because a promise without a reason reads as
 * marketing. And it lists what will never be built, together with the
 * reasonable-sounding sentence each request usually arrives as — which is the
 * part that is hard to fake, because nobody writes down the features they
 * secretly intend to ship.
 *
 * No account, deliberately: the person who most needs to read this has not
 * signed up yet and is deciding whether to.
 */
export function Promises() {
  const { t } = useI18n();

  return (
    <div className="app">
      <TopBar />
      <main className="main" id="main">
        <PageHeading title={t('promise.title')} subtitle={t('promise.headline')} />

        <p className="muted">{t('promise.intro')}</p>

        <div className="stack">
          {GUARANTEE_STATEMENTS.map(({ id }) => (
            <Card key={id}>
              <p style={{ fontWeight: 600, margin: '0 0 0.4rem', fontSize: '1.05rem' }}>
                {t(`promise.${id}` as TranslationKey)}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {t(`promise.${id}.why` as TranslationKey)}
              </p>
            </Card>
          ))}
        </div>

        {/* The half that is hard to fake. Anyone can list their virtues; a list
            of the features you are turning down, written in the words the
            request arrives in, is a different kind of claim. */}
        <Card>
          <h2>{t('promise.neverBuilt')}</h2>
          <p className="muted">{t('promise.neverBuiltIntro')}</p>
          <div className="stack">
            {FORBIDDEN_FEATURES.map((entry) => (
              <div className="need" key={entry.feature}>
                <p style={{ fontWeight: 600, margin: 0 }}>{entry.feature}</p>
                <p className="faint" style={{ margin: '0.4rem 0 0.2rem' }}>
                  {t('promise.arrivesAs')}: <em>{entry.arrivesAs}</em>
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  {entry.why}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="notice notice--warn">{t('promise.changing')}</div>

        <p className="faint">
          <Link to="/signin">{t('app.name')}</Link>
        </p>
      </main>
    </div>
  );
}
