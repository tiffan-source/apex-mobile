// Copie le document OpenAPI d'Apex Brain (`/docs-json`) dans `openapi/apex-brain.openapi.json`.
// L'adresse : `APEX_BRAIN_URL`, sinon un Apex Brain local (`npx nx serve api`, port 3000).
// Ensuite : `npm run api:types`.
import { writeFile } from 'node:fs/promises';

const base = (process.env.APEX_BRAIN_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const target = new URL('../openapi/apex-brain.openapi.json', import.meta.url);

const response = await fetch(`${base}/docs-json`);
if (!response.ok) {
  console.error(`${base}/docs-json a répondu ${response.status}.`);
  process.exit(1);
}
const document = await response.json();
await writeFile(target, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Contrat copié depuis ${base}/docs-json. Lance npm run api:types.`);
