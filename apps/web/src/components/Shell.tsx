import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n/index.js';
import { useAuth } from '../state/auth.js';
import { countQueued } from '../offline/outbox.js';
import { startOutboxSync } from '../offline/sync.js';

/**
 * The frame every signed-in screen sits inside.
 *
 * Navigation is a bottom tab bar rather than a sidebar, because almost every
 * teacher will open this on a phone held in one hand. The tabs shown depend on
 * the role: a teacher never sees a review queue they cannot act on, and an
 * officer never sees a "new activity" button for a school they do not teach at.
 */
export function Shell() {
  const { t } = useI18n();
  const { user, may } = useAuth();
  const online = useOnlineStatus();
  const queued = useQueuedCount();

  const isSchoolStaff = user?.role === 'TEACHER' || user?.role === 'PRINCIPAL';

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar />
      {!online ? (
        <p className="offline-banner" role="status">
          {t('offline.banner')}
          {queued > 0 ? ` (${queued} ${t('offline.queued')})` : ''}
        </p>
      ) : null}
      {online && queued > 0 ? (
        <p className="offline-banner" role="status">
          {queued} {t('offline.syncing')}
        </p>
      ) : null}

      <main className="main" id="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label={t('app.name')}>
        <Tab to="/app" icon="🏠" label={t('nav.home')} end />
        <Tab to="/app/activities" icon="📋" label={t('nav.activities')} />
        {isSchoolStaff ? <Tab to="/app/students" icon="🧒" label={t('nav.students')} /> : null}
        {may('activity:moderate') ? (
          <Tab to="/app/review" icon="✅" label={t('nav.review')} />
        ) : null}
        {may('report:read') ? <Tab to="/app/reports" icon="📊" label={t('nav.reports')} /> : null}
        {may('user:approve') ? <Tab to="/app/people" icon="👥" label={t('nav.people')} /> : null}
      </nav>
    </div>
  );
}

function Tab({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className="tabbar__item">
      <span className="tabbar__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

export function TopBar() {
  const { t, locale, setLocale } = useI18n();
  const { user, signOut } = useAuth();

  return (
    <header className="topbar">
      <NavLink to="/app" className="topbar__brand">
        {t('app.name')}
        {user?.schoolName ? <small>{user.schoolName}</small> : null}
      </NavLink>
      <button
        type="button"
        className="topbar__action"
        onClick={() => setLocale(locale === 'hi' ? 'en' : 'hi')}
        // Labelled in the language being switched *to*, which is how a
        // bilingual user reads a language toggle.
        aria-label={locale === 'hi' ? 'Switch to English' : 'हिन्दी में देखें'}
      >
        {locale === 'hi' ? 'EN' : 'हिं'}
      </button>
      {user ? (
        <button type="button" className="topbar__action" onClick={() => void signOut()}>
          {t('action.signOut')}
        </button>
      ) : null}
    </header>
  );
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
  return online;
}

/**
 * The number of activities waiting to be sent.
 *
 * Polled rather than pushed: the outbox is written from several places and a
 * five-second poll of an IndexedDB count is cheaper than wiring an event bus
 * through the whole app.
 */
function useQueuedCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      void countQueued().then((value) => {
        if (!cancelled) setCount(value);
      });
    };
    read();
    const timer = window.setInterval(read, 5000);
    const stopSync = startOutboxSync(() => read());
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      stopSync();
    };
  }, []);

  return count;
}
