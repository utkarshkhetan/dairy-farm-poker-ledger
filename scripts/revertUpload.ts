/**
 * Revert a specific upload: delete game(s) for a given date and remove a player.
 * Usage: npx tsx revertUpload.ts [date] [playerName]
 * Example: npx tsx revertUpload.ts 2025-02-03 John
 * Note: If the game was stored with UTC date (e.g. evening 2/3 PST = 2/4 UTC), try 2025-02-04
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

const TARGET_DATE = process.argv[2] || '2025-02-03';
const PLAYER_TO_REMOVE = process.argv[3] || 'John';

async function revertUpload() {
  console.log(`Reverting upload: deleting game(s) for date ${TARGET_DATE}, removing player "${PLAYER_TO_REMOVE}"\n`);

  const gamesRef = db.collection('games');
  const q = gamesRef.where('date', '==', TARGET_DATE);
  const snapshot = await q.get();

  if (snapshot.empty) {
    console.log(`No game found for date ${TARGET_DATE}.`);
  } else {
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
      console.log(`  Deleted game: ${doc.id} (${TARGET_DATE})`);
    }
    console.log(`Deleted ${snapshot.size} game(s) for ${TARGET_DATE}.`);
  }

  const playersRef = db.collection('players');
  const playersSnapshot = await playersRef.get();
  let removedCount = 0;

  for (const doc of playersSnapshot.docs) {
    const data = doc.data();
    if (data.name === PLAYER_TO_REMOVE) {
      await doc.ref.delete();
      console.log(`  Deleted player: ${data.name} (${doc.id})`);
      removedCount++;
    }
  }

  if (removedCount === 0) {
    console.log(`\nNo player named "${PLAYER_TO_REMOVE}" found.`);
  } else {
    console.log(`\nDeleted ${removedCount} player(s) named "${PLAYER_TO_REMOVE}".`);
  }

  console.log('\n✅ Revert complete.');
}

revertUpload().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
