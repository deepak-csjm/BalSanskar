/**
 * Photographs every screen in the product, so somebody can review it without
 * installing anything.
 *
 * The gap this fills: the only way to see what a teacher or a block officer
 * actually looks at was to install Node, pnpm and PostgreSQL, seed a database,
 * start two servers and click. That is a fine loop for whoever is writing the
 * code and a wall for everybody else — which, on this project, includes the
 * people whose opinion matters most.
 *
 * Two passes, each with a job. Hindi at 412px is the real product: what a
 * teacher holds in one hand on a cheap Android, and the version to review for
 * whether it is usable. English at 1280px is the version to put in front of an
 * officer or a funder who will never open the application.
 *
 * The images land in docs/screens/ and are committed, so a change that moves
 * something shows up in a diff rather than in a complaint.
 *
 *   pnpm shots
 *
 * It needs the API and the web app running, and a database with the demo seed.
 * If either is missing it says exactly what to run rather than timing out.
 *
 * The browser is a one-time install:
 *
 *   pnpm exec playwright install chromium
 *
 * or set CHROMIUM_PATH if the machine already has one, which is how this runs
 * in a container that ships a browser but blocks the download.
 */
import { chromium } from 'playwright';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const API = process.env.BALSANSKAR_URL ?? 'http://127.0.0.1:4000';
const WEB = process.env.BALSANSKAR_WEB_URL ?? 'http://127.0.0.1:5173';
const OUT = process.env.SHOTS_DIR ?? 'docs/screens';

/** The seeded officers. Everyone below them this script creates by hand. */
const BLOCK_OFFICER = '9999900011';
const DISTRICT_OFFICER = '9999900010';

const PASSES = [
  {
    // What a teacher actually holds. The one to judge usability on.
    name: 'hi-phone',
    locale: 'hi',
    // The browser locale as well as the app's, because a native date input
    // renders in the browser's format and a screenshot showing 09/13/2026 to a
    // reviewer in Uttar Pradesh is a misleading picture of the product.
    browserLocale: 'hi-IN',
    viewport: { width: 412, height: 900 },
  },
  {
    // What an officer or a funder sees in a slide. Never the primary.
    name: 'en-desktop',
    locale: 'en',
    browserLocale: 'en-IN',
    viewport: { width: 1280, height: 900 },
  },
];

// ---------------------------------------------------------------------------
// Talking to the API
// ---------------------------------------------------------------------------

async function call(method, path, body, token) {
  const response = await fetch(`${API}/v1${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const json = text.trim().startsWith('{') || text.trim().startsWith('[') ? JSON.parse(text) : text;
  return { status: response.status, body: json };
}

const phone = () => `9${Math.floor(Math.random() * 9e8 + 1e8)}`;

/**
 * Signs in by one-time code, which outside production is returned in the
 * response rather than sent by SMS.
 */
async function signIn(number) {
  const requested = await call('POST', '/auth/otp/request', { phone: number, purpose: 'LOGIN' });
  if (requested.status === 429) {
    throw new Error(
      `The one-time code for ${number} is still within its one-minute cooldown.\n` +
        'That is the resend guard working, not a failure. Wait a moment and run again.',
    );
  }
  if (requested.status !== 200) {
    throw new Error(`Could not request a code for ${number}: ${JSON.stringify(requested.body)}`);
  }
  const session = await call('POST', '/auth/otp/login', {
    phone: number,
    code: requested.body.devCode,
  });
  if (session.status !== 200) {
    throw new Error(`Could not sign in as ${number}: ${JSON.stringify(session.body)}`);
  }
  return session.body.tokens;
}

/**
 * Puts something on every screen.
 *
 * An empty state is worth one screenshot, not fifteen. Everything here is
 * created through the real endpoints, so what the images show is what the
 * product does rather than rows someone wrote straight into the database.
 */
async function seedScenario() {
  const officer = await signIn(BLOCK_OFFICER);
  const me = await call('GET', '/auth/me', undefined, officer.accessToken);
  const blockId = me.body.blockId;

  // A claim left pending, so the claims queue has something in it.
  const waiting = phone();
  const waitingCode = await call('POST', '/auth/otp/request', {
    phone: waiting,
    purpose: 'REGISTRATION',
  });
  await call('POST', '/school-claims', {
    phone: waiting,
    code: waitingCode.body.devCode,
    udiseCode: String(Math.floor(Math.random() * 9e10 + 1e10)),
    blockId,
    proposedNameHi: 'प्राथमिक विद्यालय भिनगा',
    proposedType: 'PRIMARY',
    villageOrWard: 'भिनगा',
    claimantName: 'सुनीता देवी',
    claimantDesignation: 'प्रधानाध्यापक',
    claimantEmployeeCode: 'UP-2019-4471',
  });

  // A school of our own, so we can be its head teacher and its teacher.
  const udise = String(Math.floor(Math.random() * 9e10 + 1e10));
  const headPhone = phone();
  const headCode = await call('POST', '/auth/otp/request', {
    phone: headPhone,
    purpose: 'REGISTRATION',
  });
  await call('POST', '/school-claims', {
    phone: headPhone,
    code: headCode.body.devCode,
    udiseCode: udise,
    blockId,
    proposedNameHi: 'प्राथमिक विद्यालय रामपुर',
    proposedType: 'COMPOSITE',
    villageOrWard: 'रामपुर',
    claimantName: 'कविता सिंह',
    claimantDesignation: 'प्रधानाध्यापक',
  });

  const queue = await call(
    'GET',
    '/school-claims?status=PENDING&limit=50',
    undefined,
    officer.accessToken,
  );
  const mine = queue.body.items.find((row) => row.udiseCode === udise);
  await call(
    'POST',
    `/school-claims/${mine.id}/decide`,
    { decision: 'VERIFY' },
    officer.accessToken,
  );

  const head = await signIn(headPhone);
  const schoolId =
    head.user?.schoolId ??
    (await call('GET', '/auth/me', undefined, head.accessToken)).body.schoolId;

  // The register, so the enrolment screen is not blank.
  await call(
    'PUT',
    `/schools/${schoolId}/enrolment`,
    {
      classes: [
        { classLevel: '1', enrolled: 24 },
        { classLevel: '2', enrolled: 21 },
        { classLevel: '3', enrolled: 26 },
        { classLevel: '4', enrolled: 19 },
        { classLevel: '5', enrolled: 23 },
      ],
      asOn: new Date().toISOString().slice(0, 10),
    },
    head.accessToken,
  );

  // A teacher, approved, with work at each stage.
  const teacherPhone = phone();
  const teacherCode = await call('POST', '/auth/otp/request', {
    phone: teacherPhone,
    purpose: 'REGISTRATION',
  });
  await call('POST', '/auth/register', {
    phone: teacherPhone,
    code: teacherCode.body.devCode,
    fullName: 'राम प्रसाद वर्मा',
    udiseCode: udise,
    designation: 'सहायक अध्यापक',
  });
  const pending = await call(
    'GET',
    '/users?status=PENDING_APPROVAL&limit=50',
    undefined,
    head.accessToken,
  );
  const newcomer = pending.body.items.find((u) => u.phone.endsWith(teacherPhone.slice(-10)));
  await call('POST', `/users/${newcomer.id}/approve`, {}, head.accessToken);
  const teacher = await signIn(teacherPhone);

  const write = async (title, description, category, schemes, day, classes) => {
    const created = await call(
      'POST',
      '/activities',
      {
        title,
        description,
        category,
        occurredOn: day,
        classLevels: classes,
        participantCount: 26,
        schemes,
        tags: [],
      },
      teacher.accessToken,
    );
    return created.body.id;
  };

  const today = new Date();
  const day = (back) => new Date(today.getTime() - back * 86_400_000).toISOString().slice(0, 10);

  // One awaiting the head teacher, so the moderation panel has a subject.
  const forReview = await write(
    'कक्षा 5 का पुस्तकालय कोना',
    'बच्चों ने दान में मिली किताबों से कक्षा में पढ़ने का कोना बनाया और हर सुबह बीस मिनट पढ़ते हैं। पढ़ने की गति में सुधार दिख रहा है।',
    'READING_AND_LIBRARY',
    ['NIPUN_BHARAT', 'READING_CAMPAIGN'],
    day(2),
    ['5'],
  );
  await call(
    'POST',
    `/activities/${forReview}/submit`,
    { requestedVisibility: 'DISTRICT' },
    teacher.accessToken,
  );

  // One attested and sent on, so the clearance queue has a subject.
  const forClearance = await write(
    'बाल वाटिका में पालक की बुवाई',
    'बच्चों ने विद्यालय की क्यारी में पालक और धनिया बोया और बारी-बारी से रोज़ सुबह पानी देते हैं। मध्याह्न भोजन में यही सब्ज़ी उपयोग होगी।',
    'COMMUNITY_ENGAGEMENT',
    ['PM_POSHAN', 'KAYAKALP'],
    day(6),
    ['4'],
  );
  await call(
    'POST',
    `/activities/${forClearance}/submit`,
    { requestedVisibility: 'DISTRICT' },
    teacher.accessToken,
  );
  await call(
    'POST',
    `/activities/${forClearance}/moderate`,
    {
      decision: 'PUBLISH',
      visibility: 'DISTRICT',
      attestation: { confirmed: true, note: 'मैंने स्वयं क्यारी देखी है।' },
    },
    head.accessToken,
  );

  // A second one waiting, flagged harder, so the queue shows that it ranks by
  // risk rather than by date.
  const alsoWaiting = await write(
    'रविवार को सफ़ाई अभियान',
    'विद्यालय परिसर और शौचालय की सफ़ाई की गई तथा बच्चों को हाथ धोने की सही विधि सिखाई गई।',
    'HEALTH_AND_NUTRITION',
    ['SWACHH_VIDYALAYA'],
    // A Sunday, which the risk assessment notices.
    (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - ((d.getDay() + 7) % 7 || 7));
      return d.toISOString().slice(0, 10);
    })(),
    ['6'],
  );
  await call(
    'POST',
    `/activities/${alsoWaiting}/submit`,
    { requestedVisibility: 'BLOCK' },
    teacher.accessToken,
  );
  await call(
    'POST',
    `/activities/${alsoWaiting}/moderate`,
    { decision: 'PUBLISH', visibility: 'BLOCK', attestation: { confirmed: true } },
    head.accessToken,
  );

  // One all the way through to the open web, so the showcase is not empty.
  const forShowcase = await write(
    'विज्ञान प्रदर्शनी में जल शुद्धिकरण माॅडल',
    'कक्षा 8 के बच्चों ने रेत, कोयले और कंकड़ से जल शुद्धिकरण का माॅडल बनाया और खंड स्तरीय प्रदर्शनी में प्रस्तुत किया।',
    'SCIENCE_AND_MATH',
    ['SCIENCE_AND_MATH'],
    day(12),
    ['8'],
  );
  await call(
    'POST',
    `/activities/${forShowcase}/submit`,
    { requestedVisibility: 'PUBLIC' },
    teacher.accessToken,
  );
  await call(
    'POST',
    `/activities/${forShowcase}/moderate`,
    { decision: 'PUBLISH', visibility: 'DISTRICT', attestation: { confirmed: true } },
    head.accessToken,
  );
  // forClearance is deliberately left waiting: an empty queue is a screenshot
  // of nothing, and the queue is one of the two screens this product turns on.
  await call(
    'POST',
    `/activities/${forShowcase}/clearance`,
    { decision: 'CLEAR' },
    officer.accessToken,
  );
  const district = await signIn(DISTRICT_OFFICER);
  await call(
    'POST',
    `/activities/${forShowcase}/moderate`,
    { decision: 'PUBLISH', visibility: 'PUBLIC' },
    district.accessToken,
  );

  return { officer, head, teacher, district, forReview };
}

// ---------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------

function screens(scenario) {
  return [
    { n: '01', name: 'signin', path: '/signin', as: null },
    { n: '02', name: 'claim-school', path: '/claim', as: null },
    { n: '03', name: 'register', path: '/register', as: null },
    { n: '04', name: 'home-teacher', path: '/app', as: scenario.teacher },
    { n: '05', name: 'activity-new', path: '/app/activities/new', as: scenario.teacher },
    { n: '06', name: 'activities', path: '/app/activities', as: scenario.teacher },
    { n: '07', name: 'review-queue', path: '/app/review', as: scenario.head },
    {
      n: '08',
      name: 'moderation-attestation',
      path: `/app/activities/${scenario.forReview}`,
      as: scenario.head,
    },
    { n: '09', name: 'enrolment', path: '/app/enrolment', as: scenario.head },
    { n: '10', name: 'people', path: '/app/people', as: scenario.head },
    { n: '11', name: 'claims-queue', path: '/app/claims', as: scenario.officer },
    { n: '12', name: 'clearance-queue', path: '/app/clearance', as: scenario.officer },
    { n: '13', name: 'reports', path: '/app/reports', as: scenario.district },
    { n: '14', name: 'showcase', path: '/showcase', as: null },
  ];
}

// ---------------------------------------------------------------------------

async function reachable(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await reachable(`${API}/v1/districts`))) {
    throw new Error(
      `No API at ${API}.\n\n` +
        '  pnpm dev            # starts the API on :4000 and the web app on :5173\n\n' +
        'and make sure the database has the demo seed — see the README.',
    );
  }
  if (!(await reachable(WEB))) {
    throw new Error(`No web app at ${WEB}.\n\n  pnpm dev\n`);
  }

  console.log('Setting up something to photograph…');
  const scenario = await seedScenario();

  // Only the images, not the directory: the README beside them is hand-written
  // and a rebuild should not eat it.
  await mkdir(OUT, { recursive: true });
  for (const stale of await readdir(OUT).catch(() => [])) {
    if (stale.endsWith('.png')) await rm(join(OUT, stale));
  }

  const executablePath = process.env.CHROMIUM_PATH;
  let browser;
  try {
    browser = await chromium.launch(executablePath ? { executablePath } : {});
  } catch (error) {
    throw new Error(
      `Could not start a browser.\n\n` +
        '  pnpm exec playwright install chromium\n\n' +
        'or point CHROMIUM_PATH at one this machine already has.\n\n' +
        String(error).split('\n')[0],
    );
  }
  const problems = [];

  for (const pass of PASSES) {
    const context = await browser.newContext({
      viewport: pass.viewport,
      locale: pass.browserLocale,
      timezoneId: 'Asia/Kolkata',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`${pass.name}: ${error}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('favicon')) {
        problems.push(`${pass.name}: ${message.text()}`);
      }
    });

    // The language is a stored preference, so it is set once per context
    // rather than clicked on every screen.
    await page.goto(`${WEB}/signin`);
    await page.evaluate((locale) => {
      try {
        localStorage.setItem('balsanskar.locale', locale);
      } catch {
        /* private window */
      }
    }, pass.locale);

    for (const screen of screens(scenario)) {
      if (screen.as) {
        await page.evaluate(
          ([access, refresh]) => {
            localStorage.setItem('balsanskar.access', access);
            localStorage.setItem('balsanskar.refresh', refresh);
          },
          [screen.as.accessToken, screen.as.refreshToken],
        );
      } else {
        await page.evaluate(() => {
          localStorage.removeItem('balsanskar.access');
          localStorage.removeItem('balsanskar.refresh');
        });
      }

      await page.goto(`${WEB}${screen.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700);
      const file = join(OUT, `${screen.n}-${screen.name}-${pass.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      process.stdout.write(`  ${file}\n`);
    }

    await context.close();
  }

  await browser.close();

  const files = (await readdir(OUT)).filter((name) => name.endsWith('.png'));
  let bytes = 0;
  for (const file of files) bytes += (await stat(join(OUT, file))).size;
  console.log(`\n${files.length} screens, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${OUT}/`);

  if (problems.length > 0) {
    // Not fatal — the images are still useful — but a page that logged an error
    // while being photographed is worth knowing about.
    console.log(`\n${problems.length} page error(s) while capturing:`);
    for (const problem of [...new Set(problems)]) console.log(`  ${problem}`);
  }
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
