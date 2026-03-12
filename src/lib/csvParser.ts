import Papa from 'papaparse';
import { UploadRow } from '../types';

export function parseUploadCSV(file: File): Promise<UploadRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<UploadRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: { data: UploadRow[] }) => {
        resolve(results.data);
      },
      error: (err: Error) => {
        reject(err);
      },
    });
  });
}

/** PST offset: UTC-8 hours in milliseconds */
const PST_OFFSET_MS = -8 * 60 * 60 * 1000;

/**
 * Extract game date from a timestamp. Uses GAME START time only (never session_end_at).
 * Ledger timestamps are UTC; we convert to PST (UTC-8) for the local game date.
 */
export function extractDateFromTimestamp(timestamp: string): string {
  // e.g. "2025-02-04T06:00:00.000Z" (Feb 4 6am UTC) = Feb 3 10pm PST -> use 2025-02-03
  const date = new Date(timestamp);
  const pstDate = new Date(date.getTime() + PST_OFFSET_MS);
  const y = pstDate.getUTCFullYear();
  const m = String(pstDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(pstDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get game date from ledger rows using GAME START time (session_start_at).
 * Uses the earliest session_start_at across all rows; never session_end_at (game end).
 */
export function getGameDateFromRows(rows: UploadRow[]): string {
  const startTimestamps = rows
    .map((r) => r.session_start_at)
    .filter((t): t is string => !!t && t.trim() !== '');
  if (startTimestamps.length === 0) throw new Error('No session_start_at found in ledger');
  const earliest = startTimestamps.reduce((a, b) => (a < b ? a : b));
  return extractDateFromTimestamp(earliest);
}

export function formatDisplayDate(dateString: string): string {
  // Convert "2026-01-25" to "1/25" (parse as YYYY-MM-DD to avoid timezone shift)
  const [, m, d] = dateString.split('-').map(Number);
  return `${m}/${d}`;
}

/**
 * Parse ledger net value from CSV (supports integer or decimal format).
 * Returns integer cents for DB consistency; invalid/empty string → 0.
 */
export function parseLedgerNet(value: string): number {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : Math.round(n);
}

export function aggregateNetByPlayer(rows: UploadRow[]): Record<string, number> {
  // Sum net values for players who appear multiple times (re-buys)
  const aggregated: Record<string, number> = {};
  
  for (const row of rows) {
    const playerId = row.player_id;
    const net = parseLedgerNet(row.net);
    
    if (aggregated[playerId]) {
      aggregated[playerId] += net;
    } else {
      aggregated[playerId] = net;
    }
  }
  
  return aggregated;
}
