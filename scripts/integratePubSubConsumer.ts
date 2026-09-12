import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serverPath = resolve(process.cwd(), 'server.ts');
const source = readFileSync(serverPath, 'utf8');

const oldImport = "import { eventBus } from './src/orchestration/events/eventBus';";
const newImport = "import { pubSubConsumer } from './src/orchestration/events/pubsubConsumer';";

if (source.includes(newImport)) {
  console.log('Pub/Sub consumer import already integrated.');
} else if (source.includes(oldImport)) {
  writeFileSync(serverPath, source.replace(oldImport, newImport));
  console.log('Replaced event bus import with durable Pub/Sub consumer import.');
}

const updated = readFileSync(serverPath, 'utf8');
const routeStart = "  app.post('/api/events/pubsub'";
const healthMarker = "\n\n  // -------------------------------------------------------------\n  // HEALTH & READINESS ENDPOINTS";
const startIndex = updated.indexOf(routeStart);
const endIndex = updated.indexOf(healthMarker, startIndex);

if (startIndex === -1) {
  if (updated.includes('pubSubConsumer.register(app);')) {
    console.log('Pub/Sub consumer route already integrated.');
    process.exit(0);
  }
  throw new Error('Could not find the existing /api/events/pubsub route. No file changes were made after import integration.');
}

if (endIndex === -1 || endIndex < startIndex) {
  throw new Error('Could not find the health endpoint marker after the Pub/Sub route.');
}

const replacement = "  pubSubConsumer.register(app);";
const result = updated.slice(0, startIndex) + replacement + updated.slice(endIndex);
writeFileSync(serverPath, result);
console.log('Integrated durable authenticated Pub/Sub consumer at /api/events/pubsub.');
