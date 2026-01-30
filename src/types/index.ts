export interface Player {
  id: string;
  name: string;
  playerIds: string[];
  nicknames: string[];
  gamesPlayedFromLedger?: number; // From CSV "Num Games Played" column
}

export interface Game {
  id: string;
  date: string; // ISO date string for sorting
  displayDate: string; // "11/20" format
  results: Record<string, number>; // playerId -> cents
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  totalWinnings: number; // cents
  gamesPlayed: number;
  gamesPlayedFromLedger?: number; // From CSV "Num Games Played" column
  averagePerGame: number; // cents
  biggestWin: number; // cents
  biggestLoss: number; // cents
  winPercentage: number; // 0-100
  standardDeviation: number;
  recentTrend: 'hot' | 'cold' | 'neutral';
  monthlyTrend: number; // cents change this month
}

export interface FunStat {
  title: string;
  description: string;
  playerName: string;
  value: string | number;
  hint?: string;
}

export interface UploadRow {
  player_nickname: string;
  player_id: string;
  session_start_at: string;
  session_end_at: string;
  buy_in: string;
  buy_out: string;
  stack: string;
  net: string;
}

export interface MatchedPlayer {
  uploadRow: UploadRow;
  matchedPlayerId: string | null;
  matchedPlayerName: string | null;
  isNew: boolean;
}
