#!/usr/bin/env node
/**
 * Guards the size of the first load.
 *
 * The users this platform is for are on 2G and on metered data. A budget that
 * is checked by a machine on every push is the only kind that survives contact
 * with a deadline, so this runs in CI and fails the build rather than filing a
 * ticket nobody reads.
 *
 * The budget covers what a phone must download before the sign-in screen can
 * appear: the entry chunk, the vendor chunk it imports, and the stylesheet.
 * Lazily loaded routes are reported but not counted — that is the whole point
 * of splitting them.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const DIST = new URL('../apps/web/dist/assets/', import.meta.url).pathname;

/** Gzipped kilobytes. Raise deliberately, with a reason, never to go green. */
const BUDGET_KB = 120;

function kb(bytes) {
  return Math.round((bytes / 1024) * 10) / 10;
}

async function main() {
  let files;
  try {
    files = await readdir(DIST);
  } catch {
    console.error(`No build output at ${DIST}. Run \`pnpm build\` first.`);
    process.exit(1);
  }

  const measured = [];
  for (const name of files) {
    if (name.endsWith('.map')) continue;
    if (!name.endsWith('.js') && !name.endsWith('.css')) continue;
    const path = join(DIST, name);
    if (!(await stat(path)).isFile()) continue;
    const contents = await readFile(path);
    measured.push({ name, gzip: gzipSync(contents, { level: 9 }).length });
  }

  // The entry chunk and the React vendor chunk are named by the Vite config and
  // the entry module; everything else is a route loaded on demand.
  const eager = measured.filter(
    (file) => /^index-.*\.(js|css)$/.test(file.name) || /^react-.*\.js$/.test(file.name),
  );
  const lazy = measured.filter((file) => !eager.includes(file)).sort((a, b) => b.gzip - a.gzip);

  const total = eager.reduce((sum, file) => sum + file.gzip, 0);

  console.log('First load (downloaded before the sign-in screen appears):');
  for (const file of eager.sort((a, b) => b.gzip - a.gzip)) {
    console.log(`  ${kb(file.gzip).toString().padStart(6)} KB  ${file.name}`);
  }
  console.log(`  ${'-'.repeat(6)}`);
  console.log(`  ${kb(total).toString().padStart(6)} KB  total (budget ${BUDGET_KB} KB)\n`);

  console.log('Loaded on demand:');
  for (const file of lazy) {
    console.log(`  ${kb(file.gzip).toString().padStart(6)} KB  ${file.name}`);
  }

  if (eager.length === 0) {
    console.error('\nNo entry chunks matched. Has the Vite output naming changed?');
    process.exit(1);
  }

  if (kb(total) > BUDGET_KB) {
    console.error(
      `\nFirst load is ${kb(total)} KB gzipped, over the ${BUDGET_KB} KB budget.\n` +
        'Move something behind a lazy route, or drop a dependency, before raising the budget.',
    );
    process.exit(1);
  }

  console.log(`\nWithin budget: ${kb(total)} KB of ${BUDGET_KB} KB.`);
}

await main();
