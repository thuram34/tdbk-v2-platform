import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRegistry } from './validate.mjs';

const registryUrl = new URL('./projects.json', import.meta.url);
const registry = JSON.parse(await readFile(registryUrl, 'utf8'));

test('canonical TDBK project registry is valid', () => {
  assert.deepEqual(validateRegistry(registry), []);
});

test('rejects duplicate project identifiers', () => {
  const duplicate = structuredClone(registry);
  duplicate.projects.push({ ...duplicate.projects[0] });
  assert.ok(validateRegistry(duplicate).some(error => error.includes('Duplicate project id')));
});

test('rejects non-HTTPS or non-GitHub repository URLs', () => {
  const invalid = structuredClone(registry);
  invalid.projects[0].repository = 'http://example.com/tdbk';
  assert.ok(validateRegistry(invalid).some(error => error.includes('canonical HTTPS GitHub')));
});

test('rejects missing verification commands', () => {
  const invalid = structuredClone(registry);
  invalid.projects[0].verification = [];
  assert.ok(validateRegistry(invalid).some(error => error.includes('verification')));
});

test('rejects unsupported capabilities', () => {
  const invalid = structuredClone(registry);
  invalid.projects[0].labCapabilities.push('remote-root-shell');
  assert.ok(validateRegistry(invalid).some(error => error.includes('unsupported capability')));
});

test('rejects duplicate repository registration', () => {
  const duplicate = structuredClone(registry);
  duplicate.projects.push({ ...duplicate.projects[0], id: 'tdbk-platform-copy' });
  assert.ok(validateRegistry(duplicate).some(error => error.includes('Duplicate repository')));
});
