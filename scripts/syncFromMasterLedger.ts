/**
 * Sync DB from master ledger CSV (Cal Dairy Farm - All Games.csv).
 *
 * We only use: Player name, optional Num Games Played (for new players), and the
 * date columns (m/d, m/d -1). We ignore Totals ($), Totals (BB), Per Game ($),
 * Per Game (BB)—those are calculated on the website from the stored game data.
 * You can compare the site’s calculated totals to the ledger to confirm that
 * all individual game data was parsed correctly.
 *
 * - Adds new players that don't exist in the DB
 * - Adds missing games with correct dates (CSV is source of truth)
 * - Fixes games that were stored 1 day behind: updates them to the CSV date
 * - Values in CSV date columns are already in cents; stored as-is in DB
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possiblePaths = [
  path.join(__dirname, '../dairy-farm-poker-ledger-firebase-adminsdk-fbsvc-a2adcc0c75.json'),
  path.join(process.cwd(), 'dairy-farm-poker-ledger-firebase-adminsdk-fbsvc-a2adcc0c75.json'),
];

const keyPath = possiblePaths.find((p) => fs.existsSync(p));
if (!keyPath) {
  console.error(
    'Missing Firebase Admin SDK key. Place dairy-farm-poker-ledger-firebase-adminsdk-fbsvc-a2adcc0c75.json in project root.'
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const KNOWN_PLAYER_IDS: Record<string, string> = {
  'Gx6CTDK1-V': 'Garrett',
  'yA8s_xTBKa': 'Sampath',
  '3eq6PWL0fX': 'Abhi',
  'LxxSO_Q8Xm': 'Shik',
  'dLUVSEvjqU': 'Ano',
};

const NICKNAME_MAPPINGS: Record<string, string> = {
  Nary: 'Nary',
  Hoot: 'Hoot',
};

/** Only columns matching m/d or m/d -1 are game dates */
const DATE_COLUMN_REGEX = /^\d{1,2}\/\d{1,2}( -1)?$/;

interface CSVRow {
  Player: string;
  'Totals ($)'?: string;
  'Totals (BB)'?: string;
  'Num Games Played'?: string;
  'Per Game ($)'?: string;
  'Per Game (BB)'?: string;
  [key: string]: string | undefined;
}

function parseDate(dateStr: string, baseYear: number): string {
  const cleanDate = dateStr.split(' ')[0];
  const [month, day] = cleanDate.split('/').map(Number);
  const inferredYear = month >= 11 ? baseYear : baseYear + 1;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${inferredYear}-${pad(month)}-${pad(day)}`;
}

function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${m}/${d}`;
}

/** Subtract one day from an ISO date (for finding games stored 1 day behind). */
function subtractOneDay(isoDate: string): string {
  const base = isoDate.replace(/-2$/, '');
  const d = new Date(base + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function main() {
  const csvPath = path.join(__dirname, '../Cal Dairy Farm - All Games.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('Master ledger not found:', csvPath);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse<CSVRow>(csvContent, { header: true, skipEmptyLines: true });

  const rows = parsed.data.filter(
    (row) => row.Player && row.Player.trim() !== '' && row.Player.trim() !== 'BB'
  );

  const headers = Object.keys(rows[0] || {});
  const dateColumns = headers.filter((h) => DATE_COLUMN_REGEX.test(h));

  console.log('Master ledger:', csvPath);
  console.log('Date columns found:', dateColumns.length);
  console.log('Player rows (excluding BB):', rows.length);

  // Load existing players (by name) and games (by date)
  const playersSnap = await db.collection('players').get();
  const existingPlayersByName = new Map<string, { id: string; name: string }>();
  playersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const name = (data.name as string)?.trim();
    if (name) existingPlayersByName.set(name, { id: doc.id, name });
  });

  const gamesSnap = await db.collection('games').get();
  const existingGamesByDate = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  gamesSnap.docs.forEach((doc) => {
    const date = doc.data().date as string;
    if (date) existingGamesByDate.set(date, doc);
  });

  console.log('Existing players:', existingPlayersByName.size);
  console.log('Existing games:', existingGamesByDate.size);

  // Build player name -> id map; create any new players
  const playersMap = new Map<string, { id: string; name: string }>();
  for (const [name, p] of existingPlayersByName) {
    playersMap.set(name, p);
  }

  let newPlayersCount = 0;
  for (const row of rows) {
    const playerName = row.Player.trim();
    if (!playerName || playerName === 'BB') continue;
    if (playersMap.has(playerName)) continue;

    const knownPlayerId = Object.entries(KNOWN_PLAYER_IDS).find(([, n]) => n === playerName)?.[0];
    const gamesPlayedFromLedger = row['Num Games Played']
      ? parseInt(row['Num Games Played'], 10)
      : undefined;
    const playerData: Record<string, unknown> = {
      name: playerName,
      playerIds: knownPlayerId ? [knownPlayerId] : [],
      nicknames: NICKNAME_MAPPINGS[playerName] ? [NICKNAME_MAPPINGS[playerName]] : [],
    };
    if (gamesPlayedFromLedger !== undefined && !isNaN(gamesPlayedFromLedger)) {
      playerData.gamesPlayedFromLedger = gamesPlayedFromLedger;
    }

    const playerRef = db.collection('players').doc();
    await playerRef.set(playerData);
    playersMap.set(playerName, { id: playerRef.id, name: playerName });
    newPlayersCount++;
    console.log('  New player:', playerName);
  }

  const baseYear = 2024;
  const gamesCreatedThisRun: string[] = [];
  const datesWrittenThisRun = new Set<string>();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const dateStr of dateColumns) {
    const gameDate = parseDate(dateStr, baseYear);
    const displayDate = formatDisplayDate(gameDate);

    let finalDate = gameDate;
    if (dateStr.includes(' -1')) {
      const hasExisting = gamesCreatedThisRun.some((d) => d.startsWith(gameDate));
      if (hasExisting) {
        finalDate = gameDate + '-2';
      }
    }

    const results: Record<string, number> = {};
    for (const row of rows) {
      const playerName = row.Player.trim();
      if (!playerName) continue;
      const player = playersMap.get(playerName);
      if (!player) continue;
      const valueStr = row[dateStr]?.trim();
      if (!valueStr || valueStr === '') continue;
      const cents = parseInt(valueStr, 10);
      if (isNaN(cents)) continue;
      if (results[player.id]) {
        results[player.id] += cents;
      } else {
        results[player.id] = cents;
      }
    }

    if (Object.keys(results).length === 0) {
      skipped++;
      continue;
    }

    const hasExactDate =
      existingGamesByDate.has(finalDate) || datesWrittenThisRun.has(finalDate);
    const oneDayBehindDate = subtractOneDay(finalDate);
    const existingOneDayBehind = finalDate.includes('-2')
      ? null
      : existingGamesByDate.get(oneDayBehindDate);

    if (hasExactDate) {
      skipped++;
      continue;
    }

    if (existingOneDayBehind) {
      await existingOneDayBehind.ref.update({
        date: finalDate,
        displayDate,
        results,
      });
      existingGamesByDate.delete(oneDayBehindDate);
      existingGamesByDate.set(finalDate, existingOneDayBehind);
      datesWrittenThisRun.add(finalDate);
      updated++;
      console.log(`  Updated (date fix): ${oneDayBehindDate} -> ${finalDate} (${displayDate})`);
    } else {
      const gameRef = db.collection('games').doc();
      await gameRef.set({ date: finalDate, displayDate, results });
      gamesCreatedThisRun.push(finalDate);
      datesWrittenThisRun.add(finalDate);
      created++;
      console.log(`  Created game: ${finalDate} (${displayDate})`);
    }
  }

  console.log('\nDone.');
  console.log('  New players added:', newPlayersCount);
  console.log('  New games created:', created);
  console.log('  Games updated (date corrected):', updated);
  console.log('  Games skipped (already exist):', skipped);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
