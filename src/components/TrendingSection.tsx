import { useMemo, useState } from 'react';
import { Player, Game } from '../types';
import { formatCurrency, getFirstName } from '../lib/statsCalculator';
import { PlayerLink } from './PlayerLink';

interface TrendingSectionProps {
  players: Player[];
  games: Game[];
}

type TrendRange = 'week' | 'month' | 'quarter';

const RANGE_LABELS: Record<TrendRange, string> = {
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
};

const RANGE_DAYS: Record<TrendRange, number> = {
  week: 7,
  month: 30,
  quarter: 90,
};

export function TrendingSection({ players, games }: TrendingSectionProps) {
  const [range, setRange] = useState<TrendRange>('week');

  const periodTotals = useMemo(() => {
    if (games.length === 0) return [];
    // Normalize any game date (string YYYY-MM-DD, Firestore Timestamp, or number) to UTC midnight timestamp
    const getGameTime = (dateInput: unknown): number => {
      if (dateInput == null) return 0;
      // Firestore Timestamp: { seconds, nanoseconds } or .toDate()
      const ts = dateInput as { seconds?: number; nanoseconds?: number; toDate?: () => Date };
      if (typeof ts.seconds === 'number') {
        const d = new Date(ts.seconds * 1000);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
      if (typeof ts.toDate === 'function') {
        const d = ts.toDate();
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
      // Number (milliseconds)
      if (typeof dateInput === 'number') {
        const d = new Date(dateInput);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
      // String: YYYY-MM-DD
      const dateStr = String(dateInput).trim();
      const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch.map(Number);
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d))
          return Date.UTC(y, m - 1, d);
      }
      // String: M/D or M/D/YYYY (e.g. from displayDate or legacy)
      const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
      if (slashMatch) {
        const [, m, d, yStr] = slashMatch;
        const month = Number(m);
        const day = Number(d);
        const year = yStr ? Number(yStr) : new Date().getUTCFullYear();
        if (!Number.isNaN(month) && !Number.isNaN(day) && !Number.isNaN(year))
          return Date.UTC(year, month - 1, day);
      }
      return 0;
    };
    // Use "today" (UTC) as end of window so last 7/30/90 days include all games in that period
    const now = new Date();
    const anchorTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 24 * 60 * 60 * 1000;
    const rangeMs = RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
    const cutoffTime = anchorTime - rangeMs;
    const periodGames = games.filter((g) => {
      const t = getGameTime(g.date);
      return t > 0 && t >= cutoffTime && t < anchorTime;
    });

    return players.map((player) => {
      const total = periodGames.reduce((sum, game) => {
        const result = game.results[player.id];
        return sum + (result ?? 0);
      }, 0);
      return { playerId: player.id, playerName: player.name, total };
    });
  }, [players, games, range]);

  const hotPlayers = [...periodTotals]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .filter((p) => p.total > 0);

  const coldPlayers = [...periodTotals]
    .sort((a, b) => a.total - b.total)
    .slice(0, 5)
    .filter((p) => p.total < 0);

  return (
    <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-xl font-bold text-white">🔥 Hot & Cold Streaks</h3>
        <div className="flex items-center gap-2 text-xs">
          {(['week', 'month', 'quarter'] as TrendRange[]).map((option) => (
            <button
              key={option}
              onClick={() => setRange(option)}
              className={`px-2.5 py-1 rounded-md border transition-all ${
                range === option
                  ? 'bg-blue-600/40 border-blue-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {RANGE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700/70">
          <h4 className="text-lg font-semibold text-white mb-3">Hot ({RANGE_LABELS[range]})</h4>
        <div className="space-y-3">
          {hotPlayers.length > 0 ? (
            hotPlayers.map((stat) => (
              <div
                key={stat.playerId}
                className="flex items-center justify-between p-3 bg-green-900/20 rounded-lg border border-green-800/50 transition-all duration-200 hover:-translate-y-0.5"
              >
                <span className="text-white font-medium">
                  <PlayerLink playerId={stat.playerId}>{getFirstName(stat.playerName)}</PlayerLink>
                </span>
                <span className="text-green-400 font-bold">
                  {formatCurrency(stat.total)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No hot streaks yet</p>
          )}
        </div>
        </div>

        <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700/70">
          <h4 className="text-lg font-semibold text-white mb-3">Cold ({RANGE_LABELS[range]})</h4>
        <div className="space-y-3">
          {coldPlayers.length > 0 ? (
            coldPlayers.map((stat) => (
              <div
                key={stat.playerId}
                className="flex items-center justify-between p-3 bg-red-900/20 rounded-lg border border-red-800/50 transition-all duration-200 hover:-translate-y-0.5"
              >
                <span className="text-white font-medium">
                  <PlayerLink playerId={stat.playerId}>{getFirstName(stat.playerName)}</PlayerLink>
                </span>
                <span className="text-red-400 font-bold">
                  {formatCurrency(stat.total)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No cold streaks yet</p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
