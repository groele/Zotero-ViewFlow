const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('packaging stops when the typecheck or bundle fails', { skip: process.platform !== 'win32' }, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'viewflow-package-guard-'));
  try {
    fs.writeFileSync(path.join(temp, 'npm.cmd'), '@exit /b 23\r\n');
    const output = path.join(temp, 'must-not-exist.xpi');
    const result = spawnSync('pwsh', ['-NoProfile', '-File', path.join(root, 'scripts/build.ps1'), '-OutputPath', output], {
      cwd: root, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, PATH: temp + path.delimiter + process.env.PATH },
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /Type check or bundle failed/);
    assert.equal(fs.existsSync(output), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
