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

export function extractDateFromTimestamp(timestamp: string): string {
  // Extract date from ISO timestamp (e.g., "2026-01-25T04:58:41.360Z" -> "2026-01-25")
  return timestamp.split('T')[0];
}

export function formatDisplayDate(dateString: string): string {
  // Convert "2026-01-25" to "1/25" (parse as YYYY-MM-DD to avoid timezone shift)
  const [, m, d] = dateString.split('-').map(Number);
  return `${m}/${d}`;
}

export function aggregateNetByPlayer(rows: UploadRow[]): Record<string, number> {
  // Sum net values for players who appear multiple times (re-buys)
  const aggregated: Record<string, number> = {};
  
  for (const row of rows) {
    const playerId = row.player_id;
    const net = parseInt(row.net, 10) || 0;
    
    if (aggregated[playerId]) {
      aggregated[playerId] += net;
    } else {
      aggregated[playerId] = net;
    }
  }
  
  return aggregated;
}
