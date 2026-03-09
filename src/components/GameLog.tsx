import { useState, useEffect } from 'react';
import { Game, Player } from '../types';
import { formatCurrency, getFirstName } from '../lib/statsCalculator';
import { PlayerLink } from './PlayerLink';

interface GameLogProps {
  games: Game[];
  players: Player[];
}

function getMostRecentGameDate(games: Game[]): string {
  if (games.length === 0) return '';
  const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0].date;
}

export function GameLog({ games, players }: GameLogProps) {
  const mostRecentDate = getMostRecentGameDate(games);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (mostRecentDate && !selectedDate) {
      setSelectedDate(mostRecentDate);
    }
  }, [mostRecentDate, selectedDate]);

  const selectedGame = games.find(g => g.date === selectedDate);

  const playerResults = selectedGame
    ? Object.entries(selectedGame.results)
        .map(([playerId, cents]) => {
          const player = players.find(p => p.id === playerId);
          return {
            playerId,
            playerName: getFirstName(player?.name || 'Unknown'),
            cents,
          };
        })
        .sort((a, b) => b.cents - a.cents)
    : [];

  const mid = Math.ceil(playerResults.length / 2);
  const leftColumn = playerResults.slice(0, mid);
  const rightColumn = playerResults.slice(mid);

  return (
    <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-white">📋 Game Log</h2>
        <div>
          <label htmlFor="game-select" className="sr-only">Select Game Date</label>
          <select
            id="game-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="min-w-[180px] px-4 py-2.5 text-base bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a game --</option>
            {games.map((game) => (
              <option key={game.id} value={game.date}>
                {game.displayDate}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedGame && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Results for {selectedGame.displayDate}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700/70 max-h-[280px] overflow-y-auto">
            <div className="space-y-2">
              {leftColumn.map((result, index) => {
                const isPositive = result.cents >= 0;
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 ${
                      isPositive
                        ? 'bg-green-900/20 border border-green-800/50'
                        : 'bg-red-900/20 border border-red-800/50'
                    }`}
                  >
                    <span className="text-white font-medium">
                      #{index + 1} <PlayerLink playerId={result.playerId}>{result.playerName}</PlayerLink>
                    </span>
                    <span
                      className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(result.cents)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700/70 max-h-[280px] overflow-y-auto">
            <div className="space-y-2">
              {rightColumn.map((result, index) => {
                const isPositive = result.cents >= 0;
                const displayIndex = mid + index;
                return (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 ${
                      isPositive
                        ? 'bg-green-900/20 border border-green-800/50'
                        : 'bg-red-900/20 border border-red-800/50'
                    }`}
                  >
                    <span className="text-white font-medium">
                      #{displayIndex + 1} <PlayerLink playerId={result.playerId}>{result.playerName}</PlayerLink>
                    </span>
                    <span
                      className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {formatCurrency(result.cents)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}

      {!selectedGame && selectedDate && (
        <p className="text-gray-500 mt-4">No game found for selected date.</p>
      )}
    </div>
  );
}
