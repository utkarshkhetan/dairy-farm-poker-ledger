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

const DATE_COLUMN_REGEX = /^\d{1,2}\/\d{1,2}( -1)?$/;

interface CSVRow {
  Player: string;
  'Num Games Played'?: string;
  [key: string]: string | undefined;
}

function parseDate(dateStr: string, baseYear: number): string {
  const cleanDate = dateStr.split(' ')[0];
  const [month, day] = cleanDate.split('/').map(Number);
  const inferredYear = month >= 11 ? baseYear : baseYear + 1;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${inferredYear}-${pad(month)}-${pad(day)}`;
}

function normalizeBaseDate(date: string): string {
  const match = date.match(/^(\d{4}-\d{2}-\d{2})(-\d+)?$/);
  return match ? match[1] : date;
}

function resolveUniqueGameDate(
  dateStr: string,
  baseYear: number,
  seenDates: Map<string, number>
): string {
  const baseDate = parseDate(dateStr, baseYear);
  const nextCount = (seenDates.get(baseDate) ?? 0) + 1;
  seenDates.set(baseDate, nextCount);
  if (nextCount === 1) return baseDate;
  return `${baseDate}-${nextCount}`;
}

async function main() {
  const csvPath = path.join(__dirname, '../Cal Dairy Farm - All Games.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const parsed = Papa.parse<CSVRow>(csvContent, { header: true, skipEmptyLines: true });

  const rows = parsed.data.filter(
    (row) => row.Player && row.Player.trim() !== '' && row.Player.trim() !== 'BB'
  );
  const headers = Object.keys(rows[0] || {});
  const dateColumns = headers.filter((h) => DATE_COLUMN_REGEX.test(h));

  const expectedPlayers = new Set(rows.map((r) => r.Player.trim()));
  const expectedGames = new Map<string, Map<string, number>>();
  const baseYear = 2024;
  const seenDates = new Map<string, number>();

  for (const dateCol of dateColumns) {
    const finalDate = resolveUniqueGameDate(dateCol, baseYear, seenDates);

    const gameResultsByName = new Map<string, number>();
    for (const row of rows) {
      const player = row.Player.trim();
      const raw = row[dateCol]?.trim();
      if (!raw) continue;
      const cents = parseInt(raw, 10);
      if (isNaN(cents)) continue;
      gameResultsByName.set(player, (gameResultsByName.get(player) ?? 0) + cents);
    }
    if (gameResultsByName.size > 0) {
      expectedGames.set(finalDate, gameResultsByName);
    }
  }

  const playersSnap = await db.collection('players').get();
  const playerIdToName = new Map<string, string>();
  const dbPlayers = new Set<string>();
  for (const doc of playersSnap.docs) {
    const name = (doc.data().name as string | undefined)?.trim();
    if (!name) continue;
    playerIdToName.set(doc.id, name);
    dbPlayers.add(name);
  }

  const gamesSnap = await db.collection('games').get();
  const dbGames = new Map<string, Map<string, number>>();
  const duplicateDates: string[] = [];
  for (const doc of gamesSnap.docs) {
    const data = doc.data();
    const date = data.date as string | undefined;
    const results = (data.results ?? {}) as Record<string, number>;
    if (!date) continue;
    const byName = new Map<string, number>();
    for (const [playerId, cents] of Object.entries(results)) {
      const name = playerIdToName.get(playerId) ?? `UNKNOWN_ID:${playerId}`;
      byName.set(name, (byName.get(name) ?? 0) + Number(cents));
    }
    if (dbGames.has(date)) {
      duplicateDates.push(date);
    }
    dbGames.set(date, byName);
  }

  const missingPlayers = [...expectedPlayers].filter((p) => !dbPlayers.has(p));
  const extraPlayers = [...dbPlayers].filter((p) => !expectedPlayers.has(p));

  const expectedDates = new Set(expectedGames.keys());
  const dbDates = new Set(dbGames.keys());
  const missingDates = [...expectedDates].filter((d) => !dbDates.has(d));
  const extraDates = [...dbDates].filter((d) => !expectedDates.has(d));

  const gameMismatches: string[] = [];
  for (const date of expectedDates) {
    if (!dbDates.has(date)) continue;
    const expected = expectedGames.get(date)!;
    const actual = dbGames.get(date)!;

    const names = new Set([...expected.keys(), ...actual.keys()]);
    for (const name of names) {
      const e = expected.get(name) ?? 0;
      const a = actual.get(name) ?? 0;
      if (e !== a) {
        gameMismatches.push(`${date} | ${name}: expected ${e}, actual ${a}`);
      }
    }
  }

  const threshold = '2025-01-28';
  const expectedAfter = [...expectedGames.keys()].filter((d) => normalizeBaseDate(d) > threshold).length;
  const actualAfter = [...dbGames.keys()].filter((d) => normalizeBaseDate(d) > threshold).length;

  console.log('=== Ledger Verification ===');
  console.log('Expected players:', expectedPlayers.size);
  console.log('DB players:', dbPlayers.size);
  console.log('Expected games:', expectedGames.size);
  console.log('DB games (unique dates):', dbGames.size);
  console.log('DB game docs (raw):', gamesSnap.size);
  console.log(`Games after 1/28 -> expected: ${expectedAfter}, db: ${actualAfter}`);

  console.log('\n--- Player diffs ---');
  console.log('Missing players:', missingPlayers.length);
  if (missingPlayers.length) console.log(missingPlayers.join(', '));
  console.log('Extra players:', extraPlayers.length);
  if (extraPlayers.length) console.log(extraPlayers.join(', '));

  console.log('\n--- Game date diffs ---');
  console.log('Duplicate DB game dates:', duplicateDates.length);
  if (duplicateDates.length) console.log(duplicateDates.join(', '));
  console.log('Missing game dates:', missingDates.length);
  if (missingDates.length) console.log(missingDates.join(', '));
  console.log('Extra game dates:', extraDates.length);
  if (extraDates.length) console.log(extraDates.join(', '));

  console.log('\n--- Game result diffs ---');
  console.log('Mismatched player results:', gameMismatches.length);
  if (gameMismatches.length) {
    for (const line of gameMismatches.slice(0, 200)) console.log(line);
    if (gameMismatches.length > 200) console.log('...truncated...');
  }

  const ok =
    missingPlayers.length === 0 &&
    extraPlayers.length === 0 &&
    duplicateDates.length === 0 &&
    missingDates.length === 0 &&
    extraDates.length === 0 &&
    gameMismatches.length === 0 &&
    expectedAfter === 17 &&
    actualAfter === 17;

  if (!ok) {
    console.error('\n❌ Verification failed.');
    process.exit(2);
  }

  console.log('\n✅ Verification passed. DB matches master ledger exactly.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
