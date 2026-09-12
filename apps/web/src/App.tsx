import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n/index.js';
import { AuthProvider, useAuth } from './state/auth.js';
import { Shell } from './components/Shell.js';
import { Spinner } from './components/ui.js';
import { SignIn } from './pages/SignIn.js';
import { Home } from './pages/Home.js';

/**
 * Routing.
 *
 * Everything except the sign-in path and the public showcase is code-split:
 * a teacher's phone should download the reporting screens and the approval
 * console only if that teacher is ever going to open them. On a 2G connection
 * the difference between a 60 KB and a 200 KB first load is the difference
 * between an app that opens and one that is abandoned.
 */

const Register = lazy(() => import('./pages/Register.js').then((m) => ({ default: m.Register })));
const ClaimSchool = lazy(() =>
  import('./pages/ClaimSchool.js').then((m) => ({ default: m.ClaimSchool })),
);
const Showcase = lazy(() => import('./pages/Showcase.js').then((m) => ({ default: m.Showcase })));
const Activities = lazy(() =>
  import('./pages/Activities.js').then((m) => ({ default: m.Activities })),
);
const ReviewQueue = lazy(() =>
  import('./pages/Activities.js').then((m) => ({ default: m.ReviewQueue })),
);
const ActivityNew = lazy(() =>
  import('./pages/ActivityNew.js').then((m) => ({ default: m.ActivityNew })),
);
const ActivityDetail = lazy(() =>
  import('./pages/ActivityDetail.js').then((m) => ({ default: m.ActivityDetail })),
);
const Students = lazy(() => import('./pages/Students.js').then((m) => ({ default: m.Students })));
const Reports = lazy(() => import('./pages/Reports.js').then((m) => ({ default: m.Reports })));
const People = lazy(() => import('./pages/People.js').then((m) => ({ default: m.People })));
const Claims = lazy(() => import('./pages/Claims.js').then((m) => ({ default: m.Claims })));
const Clearance = lazy(() =>
  import('./pages/Clearance.js').then((m) => ({ default: m.Clearance })),
);

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/register" element={<Register />} />
              <Route path="/claim" element={<ClaimSchool />} />
              <Route path="/showcase" element={<Showcase />} />

              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <Shell />
                  </RequireAuth>
                }
              >
                <Route index element={<Home />} />
                <Route path="activities" element={<Activities />} />
                <Route path="activities/new" element={<ActivityNew />} />
                <Route path="activities/:id" element={<ActivityDetail />} />
                <Route path="students" element={<Students />} />
                <Route path="review" element={<ReviewQueue />} />
                <Route path="reports" element={<Reports />} />
                <Route path="people" element={<People />} />
                <Route path="claims" element={<Claims />} />
                <Route path="clearance" element={<Clearance />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'anonymous') return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="boot">
      <Spinner />
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="main">
      <h1>{t('error.notFound')}</h1>
      <p>
        <a href="/app">{t('nav.home')}</a>
      </p>
    </div>
  );
}
