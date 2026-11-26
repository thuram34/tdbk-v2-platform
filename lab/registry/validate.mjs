import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const registryPath = fileURLToPath(new URL('./projects.json', import.meta.url));

export function validateRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['Registry must be a JSON object.'];
  }
  if (registry.schemaVersion !== 1) errors.push('schemaVersion must equal 1.');
  if (!Array.isArray(registry.projects) || registry.projects.length === 0) {
    errors.push('projects must be a non-empty array.');
    return errors;
  }

  const ids = new Set();
  const repositories = new Set();
  const allowedStatuses = new Set(['active', 'planned', 'archived']);
  const allowedCapabilities = new Set([
    'build', 'test', 'browser', 'api', 'data', 'security', 'release', 'observability'
  ]);

  for (const [index, project] of registry.projects.entries()) {
    const label = 'projects[' + index + ']';
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      errors.push(label + ' must be an object.');
      continue;
    }

    for (const field of ['id', 'name', 'repository', 'defaultBranch', 'status']) {
      if (typeof project[field] !== 'string' || project[field].trim() === '') {
        errors.push(label + '.' + field + ' must be a non-empty string.');
      }
    }

    if (typeof project.id === 'string') {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id)) {
        errors.push(label + '.id must be a lowercase kebab-case identifier.');
      }
      if (ids.has(project.id)) errors.push('Duplicate project id: ' + project.id + '.');
      ids.add(project.id);
    }

    if (typeof project.repository === 'string') {
      let parsed;
      try { parsed = new URL(project.repository); } catch { /* handled below */ }
      if (!parsed || parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' ||
          !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(parsed.pathname)) {
        errors.push(label + '.repository must be a canonical HTTPS GitHub repository URL.');
      }
      if (repositories.has(project.repository)) {
        errors.push('Duplicate repository: ' + project.repository + '.');
      }
      repositories.add(project.repository);
    }

    if (typeof project.status === 'string' && !allowedStatuses.has(project.status)) {
      errors.push(label + '.status is not supported.');
    }

    if (!Array.isArray(project.runtime) || project.runtime.length === 0 ||
        project.runtime.some(value => typeof value !== 'string' || !value.trim())) {
      errors.push(label + '.runtime must be a non-empty array of strings.');
    }

    if (!Array.isArray(project.environments) || project.environments.length === 0 ||
        project.environments.some(value => typeof value !== 'string' || !value.trim())) {
      errors.push(label + '.environments must be a non-empty array of strings.');
    }

    if (!Array.isArray(project.verification) || project.verification.length === 0 ||
        project.verification.some(value => typeof value !== 'string' || !value.trim())) {
      errors.push(label + '.verification must contain reproducible commands.');
    }

    if (!Array.isArray(project.labCapabilities) ||
        project.labCapabilities.some(value => !allowedCapabilities.has(value))) {
      errors.push(label + '.labCapabilities contains an unsupported capability.');
    }
  }

  return errors;
}

async function main() {
  const source = await readFile(registryPath, 'utf8');
  const registry = JSON.parse(source);
  const errors = validateRegistry(registry);
  if (errors.length) {
    for (const error of errors) process.stderr.write('ERROR: ' + error + '\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write('TDBK LAB registry valid: ' + registry.projects.length + ' project(s).\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write('Registry validation failed: ' + error.message + '\n');
    process.exitCode = 1;
  });
}
