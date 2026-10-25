import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const action = path.resolve(import.meta.dirname, '../dist/main/index.js');
const isolateHome = `
  import os from 'node:os';
  import { syncBuiltinESMExports } from 'node:module';
  os.homedir = () => process.env.NIX_S3_ACTION_TEST_HOME;
  syncBuiltinESMExports();
`;

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'nix-s3-action-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  mkdirSync(bin);

  for (const command of ['sh', 'nix']) {
    writeFileSync(path.join(bin, command), `#!${process.execPath}
      require('node:fs').writeFileSync(
        process.env.NIX_S3_ACTION_TEST_COMMAND,
        JSON.stringify({ command: '${command}', args: process.argv.slice(2) })
      );
      process.exit(Number(process.env.NIX_S3_ACTION_TEST_EXIT_CODE || 0));
    `, { mode: 0o755 });
  }

  const state = path.join(root, 'state');
  const command = path.join(root, 'command.json');
  writeFileSync(state, '');
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    GITHUB_STATE: state,
    NIX_S3_ACTION_TEST_HOME: root,
    NIX_S3_ACTION_TEST_COMMAND: command,
    NIX_S3_ACTION_TEST_EXIT_CODE: '0',
    INPUT_ENDPOINT: 's3://test-cache?endpoint=https://example.invalid',
    INPUT_SIGNINGKEY: 'test-signing-key',
    INPUT_AWSACCESSKEYID: 'test-access-key',
    INPUT_AWSSECRETACCESSKEY: 'test-secret-key',
    INPUT_SKIPPUSH: 'false',
    INPUT_PATHSTOPUSH: '/nix/store/test-one /nix/store/test-two',
    INPUT_PUSHFILTER: '',
    INPUT_NIXARGS: '',
    STATE_isPost: '',
  };

  return {
    root,
    state,
    command,
    run(overrides = {}) {
      return spawnSync(process.execPath, [
        '--import', `data:text/javascript,${encodeURIComponent(isolateHome)}`,
        action,
      ], { cwd: root, env: { ...env, ...overrides }, encoding: 'utf8' });
    },
  };
}

function success(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

test('setup writes credentials and saves state for the post action', t => {
  const f = fixture(t);
  success(f.run());
  assert.equal(readFileSync(path.join(f.root, '.nix/nix-cache-key.sec'), 'utf8'), 'test-signing-key');
  assert.match(readFileSync(path.join(f.root, '.aws/credentials'), 'utf8'), /aws_access_key_id = test-access-key/);
  assert.match(readFileSync(path.join(f.root, '.aws/credentials'), 'utf8'), /aws_secret_access_key = test-secret-key/);
  assert.match(readFileSync(path.join(f.root, '.aws/config'), 'utf8'), /region = auto/);
  assert.match(readFileSync(f.state, 'utf8'), /isPost<<[^\r\n]+\r?\ntrue\r?\n/);
  assert.deepEqual(JSON.parse(readFileSync(f.command, 'utf8')), {
    command: 'sh',
    args: ['-c', `${path.dirname(action)}/list-nix-store.sh > /tmp/store-path-pre-build`],
  });
});

test('setup without signing credentials skips cache configuration', t => {
  const f = fixture(t);
  const result = f.run({ INPUT_SIGNINGKEY: '' });
  success(result);
  assert.match(result.stdout, /skipping cache setup \/ push/);
  assert.equal(existsSync(path.join(f.root, '.aws')), false);
  assert.equal(existsSync(f.command), false);
});

test('post action honors skipPush', t => {
  const f = fixture(t);
  const result = f.run({ STATE_isPost: 'true', INPUT_SKIPPUSH: 'true' });
  success(result);
  assert.match(result.stdout, /Pushing is disabled as skipPush is set to true/);
  assert.equal(existsSync(f.command), false);
});

test('post action passes the cache URL, Nix arguments and selected paths', t => {
  const f = fixture(t);
  success(f.run({ STATE_isPost: 'true', INPUT_NIXARGS: '--jobs 2' }));
  const { command, args } = JSON.parse(readFileSync(f.command, 'utf8'));
  assert.equal(command, 'nix');
  assert.deepEqual(args.slice(0, 4), ['copy', '--jobs', '2', '--to']);
  const endpoint = new URL(args[4]);
  assert.equal(endpoint.protocol, 's3:');
  assert.equal(endpoint.hostname, 'test-cache');
  assert.equal(endpoint.searchParams.get('endpoint'), 'https://example.invalid');
  assert.equal(endpoint.searchParams.get('compression'), 'zstd');
  assert.equal(endpoint.searchParams.get('parallel-compression'), 'true');
  assert.equal(endpoint.searchParams.get('secret-key'), path.join(f.root, '.nix/nix-cache-key.sec'));
  assert.deepEqual(args.slice(5), ['/nix/store/test-one', '/nix/store/test-two']);
});

test('post action reports a failed Nix upload', t => {
  const f = fixture(t);
  const result = f.run({ STATE_isPost: 'true', NIX_S3_ACTION_TEST_EXIT_CODE: '7' });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /Action failed with error/);
});
