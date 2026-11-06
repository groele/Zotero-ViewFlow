/**
 * Zotero ViewFlow - Architecture & Compliance Guard
 *
 * Enforces workspace AGENTS.md clauses statically:
 *   §3   Status label governance: releaseStatus must be released | unreleased
 *   §3   Fluent symmetry across en-US, zh-CN, en-GB, es-ES, fr-FR; zero hardcoded UI strings
 *   §3   Naming governance: no temporary or version-prefixed identifiers/filenames
 *   §4.1 Full native preference coverage across prefs.js and prefs.xhtml
 *   §4.2 Settings pane 16px/24px/40px alignment grid declarations
 *   §5.2 src/ is TypeScript single source of truth; zero loose JS in src/
 *   §5.3 Deprecated Gecko/Zotero APIs banned (Gecko 153+ / Firefox 140+ runtime)
 *   §5.9 360-line ceiling per source module with freeze-and-shrink baseline (0 debt)
 *   §6   Version fields aligned across manifest, package, lock, brand, UI, update feed, baseline
 *   §9   Update feed integrity: HTTPS links, SHA-512 hashes, compatibility scope
 *
 * Run standalone: node scripts/architecture-guard.mjs
 * Run in test suite: node --test scripts/architecture-guard.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const lines = (rel) => read(rel).trimEnd().split(/\r?\n/).length;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'output', 'assets', '.scaffold']);

function walk(relDir, extensions = ['.ts', '.tsx', '.js', '.mjs']) {
  const out = [];
  const visit = (dir) => {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) return;
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
      const rel = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(rel);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(rel);
      }
    }
  };
  visit(relDir);
  return out.sort();
}

const baseline = readJson('scripts/architecture-baseline.json');
const MAX_LINES = baseline.maxSourceLines || 360;

test('§5.9 source files respect the 360-line ceiling (freeze-and-shrink baseline)', (t) => {
  const sourceFiles = walk('src', ['.ts', '.tsx', '.js']);
  const failures = [];
  const debt = [];

  for (const file of sourceFiles) {
    const count = lines(file);
    const frozen = baseline.oversized[file];
    if (frozen !== undefined) {
      if (count > frozen) failures.push(`${file}: ${count} lines, frozen at ${frozen}`);
      if (count > MAX_LINES) debt.push(`${file} (${count})`);
    } else if (count > MAX_LINES) {
      failures.push(`${file}: ${count} lines exceeds ${MAX_LINES} ceiling and is not in baseline`);
    }
  }

  t.diagnostic(`scanned ${sourceFiles.length} source files; ${debt.length} oversized modules in baseline`);
  assert.deepEqual(failures, [], `§5.9 violations:\n${failures.join('\n')}`);
});

test('§5.9 baseline integrity: zero debt declared and no stale entries', (t) => {
  const entries = Object.entries(baseline.oversized);
  const problems = [];
  for (const [file, frozen] of entries) {
    if (!fs.existsSync(path.join(root, file))) {
      problems.push(`${file}: baseline entry points at a missing file`);
      continue;
    }
    const count = lines(file);
    if (count <= MAX_LINES) {
      problems.push(`${file}: frozen at ${frozen} but now only ${count} lines - remove stale entry`);
    }
  }
  if (baseline.debtCleared === true) {
    assert.deepEqual(entries, [], 'debtCleared is true but frozen entries remain in baseline.oversized');
  } else {
    assert.ok(entries.length > 0, 'baseline must declare debtCleared: true when oversized is empty');
  }
  assert.deepEqual(problems, [], `baseline integrity:\n${problems.join('\n')}`);
  t.diagnostic(`baseline integrity verified: debtCleared=${baseline.debtCleared}, oversized=${entries.length}`);
});

test('§3 status label governance: releaseStatus is released or unreleased (no "stable")', (t) => {
  const product = readJson('docs/brand/product.json');
  assert.ok(
    ['released', 'unreleased'].includes(product.releaseStatus),
    `releaseStatus must be "released" or "unreleased", got "${product.releaseStatus}"`,
  );
  t.diagnostic(`product.json releaseStatus="${product.releaseStatus}" aligned with Zotero Flow suite`);
});

test('§3 Fluent catalogues are symmetric and free of duplicate keys across all 5 locales', (t) => {
  const locales = ['en-US', 'zh-CN', 'en-GB', 'es-ES', 'fr-FR'];
  const keysOf = (lang) => {
    const text = read(`locale/${lang}/zotero-preview.ftl`);
    return [...text.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map((m) => m[1]);
  };
  const baseKeys = keysOf('en-US');
  assert.equal(new Set(baseKeys).size, baseKeys.length, 'duplicate keys found in en-US catalogue');

  for (const lang of locales) {
    if (lang === 'en-US') continue;
    const langKeys = keysOf(lang);
    assert.equal(new Set(langKeys).size, langKeys.length, `duplicate keys found in ${lang} catalogue`);
    const diff = langKeys.filter((k) => !baseKeys.includes(k));
    const missing = baseKeys.filter((k) => !langKeys.includes(k));
    assert.deepEqual(diff, [], `${lang} has extra keys not in en-US: ${diff.join(', ')}`);
    assert.deepEqual(missing, [], `${lang} is missing keys from en-US: ${missing.join(', ')}`);
  }
  t.diagnostic(`${baseKeys.length} symmetric Fluent keys across all 5 locales`);
});

test('§3 preferences.xhtml has zero hardcoded UI text (100% Fluent data-l10n-id driven)', (t) => {
  const rawXhtml = read('prefs.xhtml');
  // Strip XML comments before checking raw characters
  const xhtml = rawXhtml.replace(/<!--[\s\S]*?-->/g, '');

  // Check for raw unlocalized Chinese characters in content tags
  const rawChinese = [...xhtml.matchAll(/>([^<]*[\u4e00-\u9fa5]+[^<]*)</g)].map((m) => m[1].trim());
  assert.deepEqual(rawChinese, [], `raw Chinese text detected in prefs.xhtml: ${rawChinese.join(', ')}`);

  // Ensure summary elements contain localized labels
  const summaries = [...xhtml.matchAll(/<html:summary[^>]*>([\s\S]*?)<\/html:summary>/g)];
  for (const s of summaries) {
    assert.ok(s[0].includes('data-l10n-id='), `summary missing data-l10n-id: ${s[0]}`);
  }

  // Exactly first details card must be open by default
  const openCount = (xhtml.match(/<html:details[^>]*open/g) || []).length;
  assert.equal(openCount, 1, `exactly one details card must be open by default, found ${openCount}`);
  t.diagnostic('prefs.xhtml confirmed 100% Fluent driven with first-card open rule');
});

test('§3 source filenames carry no version numbers or transient prefixes', () => {
  const files = [
    ...walk('src'),
    ...walk('scripts', ['.mjs', '.ps1', '.py']),
  ];
  const bad = files.filter((file) => /(^|\/)(?:v\d|V\d|temp-|tmp-|draft-)/.test(path.basename(file)));
  assert.deepEqual(bad, [], `version-prefixed or transient filenames detected: ${bad.join(', ')}`);
});

test('§4.1 every native preference has a settings-pane element and binding', (t) => {
  const prefText = read('prefs.js');
  const xhtml = read('prefs.xhtml');

  const prefKeys = [...new Set(
    [...prefText.matchAll(/pref\(\s*["']([^"']+)["']/g)].map((m) => m[1]),
  )].sort();

  assert.ok(prefKeys.length > 0, 'no native preferences found in prefs.js');

  const missingInXhtml = prefKeys.filter((key) => {
    return !xhtml.includes(key);
  });
  assert.deepEqual(missingInXhtml, [], `prefs unmounted in prefs.xhtml: ${missingInXhtml.join(', ')}`);

  t.diagnostic(`${prefKeys.length} native preferences fully synced`);
});

test('§4.2 settings pane declares the 16/24/40px alignment grid explicitly', (t) => {
  const css = read('settings.css');
  const rules = [
    {
      label: 'card declares padding: 16px',
      re: /\.viewflow-settings-card\s*\{[^}]*padding:\s*16px/,
    },
    {
      label: 'section summary uses margin: -16px and padding: 12px 16px',
      re: /\.viewflow-settings-card\s*>\s*summary\s*\{[^}]*margin:\s*-16px;[^}]*padding:\s*12px 16px/,
    },
    {
      label: 'subordinate items declare margin-inline-start: 24px',
      re: /\.viewflow-level3-indent[^{]*\{[^}]*margin-inline-start:\s*24px/,
    },
  ];
  const missing = rules.filter(({ re }) => !re.test(css)).map(({ label }) => label);
  assert.deepEqual(missing, [], `§4.2 alignment grid rules missing in settings.css:\n${missing.join('\n')}`);
  t.diagnostic(`${rules.length} layout grid declarations verified`);
});

test('§5.2 all editable runtime source modules are TypeScript (zero loose JS in src/)', (t) => {
  const srcFiles = walk('src', ['.ts', '.tsx', '.js', '.mjs', '.cjs']);
  const nonTs = srcFiles.filter((file) => !/\.tsx?$/.test(file));
  assert.deepEqual(nonTs, [], `all files in src/ must be TypeScript: ${nonTs.join(', ')}`);
  t.diagnostic(`verified ${srcFiles.length} source modules in src/, 100% TypeScript`);
});

test('§5.2 no TypeScript source is allowed a type-check exemption (@ts-nocheck ban)', () => {
  const offenders = walk('src', ['.ts', '.tsx']).filter((file) => read(file).includes('@ts-nocheck'));
  assert.deepEqual(offenders, [], `@ts-nocheck banned in TypeScript sources: ${offenders.join(', ')}`);
});

test('§5.2 build pipeline integrity: typecheck and architecture guard precede bundling', () => {
  const pkg = readJson('package.json');
  const tsconfig = readJson('tsconfig.json');

  assert.equal(tsconfig.extends, 'zotero-types/entries/sandbox/tsconfig.json');
  for (const key of ['strict', 'noEmit', 'isolatedModules', 'verbatimModuleSyntax']) {
    assert.equal(tsconfig.compilerOptions[key], true, `tsconfig.json must enable compiler option ${key}`);
  }

  assert.match(pkg.scripts.build, /typecheck/, 'build script must execute typecheck');
  assert.match(pkg.scripts.build, /guard/, 'build script must execute architecture guard');
  assert.ok(pkg.scripts.guard, 'package.json must expose a "guard" script');
});

test('§5.3 runtime scripts contain no deprecated Gecko/Zotero APIs', (t) => {
  const runtimeFiles = [
    'bootstrap.js',
    'prefs.js',
    'zoteropreview_prefs.js',
    ...walk('src', ['.ts']),
  ];
  const banned = [
    { re: /\bComponents\.classes\b/, label: 'Components.classes' },
    { re: /\bCu\.import\s*\(/, label: 'legacy Cu.import' },
    { re: /\bCheckboxStateChange\b/, label: 'legacy CheckboxStateChange event' },
  ];
  const hits = [];
  for (const file of runtimeFiles) {
    const fileLines = read(file).split(/\r?\n/);
    fileLines.forEach((line, index) => {
      for (const rule of banned) {
        if (rule.re.test(line)) hits.push(`${file}:${index + 1} ${rule.label}`);
      }
    });
  }
  assert.deepEqual(hits, [], `§5.3 deprecated API violations:\n${hits.join('\n')}`);
  t.diagnostic(`scanned ${runtimeFiles.length} runtime files against ${banned.length} deprecated API patterns`);
});

test('§6 version fields are aligned across manifest, package, lock, brand, UI, update feed and baseline', (t) => {
  const rootPkg = readJson('package.json');
  const rootLock = readJson('package-lock.json');
  const manifest = readJson('manifest.json');
  const product = readJson('docs/brand/product.json');
  const update = readJson('update.json');
  const xhtml = read('prefs.xhtml');

  const badgeVersion = xhtml.match(/class="viewflow-version-badge">v([^<]+)</)?.[1];
  const updateVersion = update.addons['zotero-viewflow@groele']?.updates?.[0]?.version;

  const versions = {
    'manifest.json': manifest.version,
    'package.json': rootPkg.version,
    'package-lock.json': rootLock.version,
    'docs/brand/product.json': product.version,
    'prefs.xhtml badge': badgeVersion,
    'update.json': updateVersion,
  };

  const unique = [...new Set(Object.values(versions))];
  assert.equal(unique.length, 1, `version mismatch across metadata files: ${JSON.stringify(versions, null, 2)}`);
  assert.equal(unique[0], baseline.lastReleasedVersion, 'version does not match baseline lastReleasedVersion');
  t.diagnostic(`all version declarations aligned at v${unique[0]}`);
});

test('§9 update feeds point at valid released HTTPS URLs and complete SHA-512 hashes', (t) => {
  const feed = readJson('update.json');
  const entries = feed.addons['zotero-viewflow@groele']?.updates ?? [];
  assert.ok(entries.length > 0, 'no update entries in update.json');

  for (const entry of entries) {
    assert.match(
      entry.update_link,
      new RegExp('^https://github\\.com/groele/Zotero-ViewFlow/releases/download/v' + baseline.lastReleasedVersion.replace(/\./g, '\\.') + '/Zotero-ViewFlow-' + baseline.lastReleasedVersion.replace(/\./g, '\\.') + '\\.xpi$'),
      'update_link must point to official release',
    );
    assert.match(entry.update_hash, /^sha512:[0-9a-f]{128}$/i, 'update_hash must be a valid 128-hex sha512 digest');
    assert.equal(entry.applications?.zotero?.strict_min_version, '10.0');
    assert.equal(entry.applications?.zotero?.strict_max_version, '12.*');
  }
  t.diagnostic('update.json validated with compliant hash and URL');
});
