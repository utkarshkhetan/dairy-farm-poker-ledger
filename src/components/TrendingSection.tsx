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
    // Parse YYYY-MM-DD as UTC midnight so ranges are consistent across timezones
    const getGameTime = (dateInput: string | unknown): number => {
      const dateStr = typeof dateInput === 'string' ? dateInput : '';
      const s = dateStr.slice(0, 10);
      const parts = s.split('-').map(Number);
      if (parts.length !== 3) return 0;
      const [y, m, d] = parts;
      if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 0;
      return Date.UTC(y, m - 1, d);
    };
    const anchorTime = games.reduce((latest, game) => {
      const t = getGameTime(game.date);
      return t > latest ? t : latest;
    }, 0);
    if (anchorTime === 0) return [];
    const rangeMs = RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
    const cutoffTime = anchorTime - rangeMs;
    const periodGames = games.filter((g) => getGameTime(g.date) >= cutoffTime);

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
