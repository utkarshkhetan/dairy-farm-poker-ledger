import { PlayerStats } from '../types';
import { formatCurrency } from '../lib/statsCalculator';

interface LifetimeStandingsProps {
  standings: PlayerStats[];
}

export function LifetimeStandings({ standings }: LifetimeStandingsProps) {
  const mid = Math.ceil(standings.length / 2);
  const leftColumn = standings.slice(0, mid);
  const rightColumn = standings.slice(mid);

  const renderStanding = (stat: PlayerStats, index: number) => {
    const isPositive = stat.totalWinnings >= 0;
    const avgPositive = stat.averagePerGame >= 0;
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

    return (
      <div
              key={stat.playerId}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 ${
                isPositive ? 'bg-green-900/20 border border-green-800/50' : 'bg-red-900/20 border border-red-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{medal}</span>
                <span className="text-sm font-semibold text-white">
                  #{index + 1} {stat.playerName}
                </span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <div className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(stat.totalWinnings)}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {stat.gamesPlayed} game{stat.gamesPlayed !== 1 ? 's' : ''}
                    {stat.gamesPlayedFromLedger !== undefined && stat.gamesPlayedFromLedger !== stat.gamesPlayed && (
                      <span className="ml-1 opacity-75">(ledger: {stat.gamesPlayedFromLedger})</span>
                    )}
                  </div>
                </div>
                <div className="min-w-[72px] text-right">
                  <div className={`text-lg font-bold ${avgPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(stat.averagePerGame)}
                  </div>
                  <div className="text-[11px] text-gray-500">avg</div>
                </div>
              </div>
            </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-white">🏆 Lifetime Standings</h2>
        <div className="text-xs text-gray-400">Total | Avg / Game</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="space-y-2">
          {leftColumn.map((stat, i) => renderStanding(stat, i))}
        </div>
        <div className="space-y-2">
          {rightColumn.map((stat, i) => renderStanding(stat, mid + i))}
        </div>
      </div>
    </div>
  );
}
