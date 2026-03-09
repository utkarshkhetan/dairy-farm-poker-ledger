/**
 * Migrate existing game dates: subtract 1 day from each (games are evenings PST).
 * Run after revert if needed. Usage: npx tsx migrateDatesToPST.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possiblePaths = [
  path.join(__dirname, '../dairy-farm-poker-ledger-firebase-adminsdk-fbsvc-a2adcc0c75.json'),
  path.join(process.cwd(), 'dairy-farm-poker-ledger-firebase-adminsdk-fbsvc-a2adcc0c75.json'),
];

const keyPath = possiblePaths.find((p) => fs.existsSync(p));
if (!keyPath) {
  console.error('Missing Firebase Admin SDK key. Place the key file in project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function formatDisplayDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

function subtractOneDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function migrate() {
  console.log('Migrating game dates: subtracting 1 day (PST evening correction)...\n');

  const gamesRef = db.collection('games');
  const snapshot = await gamesRef.get();

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const oldDate = data.date as string;
    const newDate = subtractOneDay(oldDate);
    const newDisplayDate = formatDisplayDate(newDate);

    await doc.ref.update({ date: newDate, displayDate: newDisplayDate });
    console.log(`  ${oldDate} -> ${newDate} (${data.displayDate} -> ${newDisplayDate})`);
    count++;
  }

  console.log(`\n✅ Migrated ${count} games.`);
}

migrate().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
