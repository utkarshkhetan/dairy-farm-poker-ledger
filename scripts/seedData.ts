import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve service account path: project root or scripts/
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

const serviceAccount = JSON.parse(
  fs.readFileSync(keyPath, 'utf-8')
);

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Known player IDs mapping
const KNOWN_PLAYER_IDS: Record<string, string> = {
  'Gx6CTDK1-V': 'Garrett',
  'yA8s_xTBKa': 'Sampath',
  '3eq6PWL0fX': 'Abhi',
  'LxxSO_Q8Xm': 'Shik',
  'dLUVSEvjqU': 'Ano',
};

// Players that typically use consistent nicknames
const NICKNAME_MAPPINGS: Record<string, string> = {
  Nary: 'Nary',
  Hoot: 'Hoot',
};

// Columns to skip when parsing game dates (Player, Totals, Num Games Played, Per Game)
const SKIP_HEADERS = ['Player', 'Totals', 'Num Games Played', 'Per Game'];

interface CSVRow {
  Player: string;
  Totals: string;
  'Num Games Played'?: string;
  'Per Game'?: string;
  [key: string]: string | undefined;
}

function parseDate(dateStr: string, baseYear: number): string {
  const cleanDate = dateStr.split(' ')[0];
  const [month, day] = cleanDate.split('/').map(Number);
  const inferredYear = month >= 11 ? baseYear : baseYear + 1;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${inferredYear}-${pad(month)}-${pad(day)}`;
}

function formatDisplayDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

async function clearAllData() {
  console.log('Clearing all players and games...');

  const playersRef = db.collection('players');
  const playersSnapshot = await playersRef.get();
  const playerDeletePromises = playersSnapshot.docs.map((doc) => doc.ref.delete());
  await Promise.all(playerDeletePromises);
  console.log(`  Deleted ${playersSnapshot.size} players`);

  const gamesRef = db.collection('games');
  const gamesSnapshot = await gamesRef.get();
  const gameDeletePromises = gamesSnapshot.docs.map((doc) => doc.ref.delete());
  await Promise.all(gameDeletePromises);
  console.log(`  Deleted ${gamesSnapshot.size} games`);

  console.log('Clear complete.\n');
}

async function seedData() {
  try {
    const csvPath = path.join(__dirname, '../Cal Dairy Farm - All Games.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const parsed = Papa.parse<CSVRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data.filter((row) => row.Player && row.Player.trim() !== '');

    const gameDates: string[] = [];
    const headers = Object.keys(rows[0] || {});
    for (const header of headers) {
      if (!SKIP_HEADERS.includes(header)) {
        gameDates.push(header);
      }
    }

    const playersMap = new Map<
      string,
      { id: string; name: string; playerIds: string[]; nicknames: string[]; gamesPlayedFromLedger?: number }
    >();

    for (const row of rows) {
      const playerName = row.Player.trim();
      if (!playerName) continue;

      const knownPlayerId = Object.entries(KNOWN_PLAYER_IDS).find(
        ([, name]) => name === playerName
      )?.[0];

      const gamesPlayedFromLedger = row['Num Games Played']
        ? parseInt(row['Num Games Played'], 10)
        : undefined;

      const playerData = {
        name: playerName,
        playerIds: knownPlayerId ? [knownPlayerId] : [],
        nicknames: NICKNAME_MAPPINGS[playerName] ? [NICKNAME_MAPPINGS[playerName]] : [],
        ...(gamesPlayedFromLedger !== undefined && !isNaN(gamesPlayedFromLedger)
          ? { gamesPlayedFromLedger }
          : {}),
      };

      const playerRef = db.collection('players').doc();
      await playerRef.set(playerData);
      playersMap.set(playerName, { id: playerRef.id, ...playerData });
    }

    console.log(`Created ${playersMap.size} players`);

    const baseYear = 2024;
    const gamesCreated: string[] = [];

    for (const dateStr of gameDates) {
      try {
        const gameDate = parseDate(dateStr, baseYear);
        const displayDate = formatDisplayDate(gameDate);

        let finalDate = gameDate;
        if (dateStr.includes(' -1')) {
          const hasExisting = gamesCreated.some((d) => d.startsWith(gameDate));
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

          // Values in game date columns are already in cents (e.g., -4000 = -$40)
          const cents = parseInt(valueStr, 10);
          if (isNaN(cents)) continue;

          if (results[player.id]) {
            results[player.id] += cents;
          } else {
            results[player.id] = cents;
          }
        }

        if (Object.keys(results).length > 0) {
          const gameRef = db.collection('games').doc();
          await gameRef.set({
            date: finalDate,
            displayDate,
            results,
          });
          gamesCreated.push(finalDate);
          console.log(`Created game for ${displayDate} (${finalDate})`);
        }
      } catch (err) {
        console.error(`Error processing date ${dateStr}:`, err);
      }
    }

    console.log(
      `\n✅ Seed complete! Created ${playersMap.size} players and ${gamesCreated.length} games.`
    );
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

async function main() {
  await clearAllData();
  await seedData();
}

main();
