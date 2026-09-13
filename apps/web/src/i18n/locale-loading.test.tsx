import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useI18n } from './index.js';

/**
 * Only the language being read is downloaded.
 *
 * Hindi ships with the first load and English arrives as a separate chunk,
 * which took roughly 6 KB off a 97 KB budget and halved what every future
 * feature costs. It also made language selection asynchronous, and an async
 * path that is never exercised is an async path that is broken — so the two
 * cases that matter are tested here: a Hindi reader must never wait, and an
 * English reader must never be shown Hindi text and then have it change under
 * them.
 */

function Probe() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <p data-testid="locale">{locale}</p>
      <p data-testid="title">{t('promise.title')}</p>
      <button type="button" onClick={() => setLocale(locale === 'hi' ? 'en' : 'hi')}>
        switch
      </button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {
    // jsdom without storage; the provider copes and so does this.
  }
});

describe('loading only the language being read', () => {
  it('gives a Hindi reader their strings with no wait at all', () => {
    // jsdom reports navigator.language as English, so the stored choice has to
    // be explicit here — which is also the real path for a teacher who has
    // picked Hindi once on a phone whose system language is not Hindi.
    localStorage.setItem('balsanskar.locale', 'hi');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    // Synchronously, on the very first render — not after a tick. This is the
    // common case and the whole reason Hindi stays in the first load.
    expect(screen.getByTestId('title')).toHaveTextContent('हमारे वचन');
  });

  it('fetches English on request and renders it, never a mix', async () => {
    localStorage.setItem('balsanskar.locale', 'hi');
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'switch' }));

    await waitFor(() => {
      expect(screen.getByTestId('locale')).toHaveTextContent('en');
      expect(screen.getByTestId('title')).toHaveTextContent('Our promises');
    });
  });

  it('waits rather than showing Hindi to somebody who asked for English', async () => {
    localStorage.setItem('balsanskar.locale', 'en');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    // Before the chunk lands there is a boot screen, not the Hindi string. An
    // interface that changes language under the reader is worse than one that
    // takes a moment to appear.
    expect(screen.queryByTestId('title')).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveTextContent('Our promises');
    });
  });

  it('goes back to Hindi without another round trip', async () => {
    const user = userEvent.setup();
    localStorage.setItem('balsanskar.locale', 'en');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('Our promises'));

    await user.click(screen.getByRole('button', { name: 'switch' }));
    await waitFor(() => expect(screen.getByTestId('title')).toHaveTextContent('हमारे वचन'));
  });
});
