import { FunStat, Player } from '../types';
import { getFirstName } from '../lib/statsCalculator';
import { PlayerLink } from './PlayerLink';

interface FunStatsProps {
  stats: FunStat[];
  players: Player[];
}

export function FunStats({ stats, players }: FunStatsProps) {
  return (
    <div className="bg-gray-800/75 rounded-xl p-6 border border-gray-700 h-full">
      <h2 className="text-2xl font-bold text-white mb-4">🎲 Fun Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {stats.map((stat, index) => {
          const playerId = players.find((p) => p.name === stat.playerName)?.id;
          return (
          <div
            key={index}
            className="group relative bg-gray-900/70 rounded-lg p-4 border border-gray-700 hover:border-gray-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-gray-900"
          >
            <div className="text-2xl mb-2">{stat.title}</div>
            <div className="text-sm text-gray-400 mb-3">{stat.description}</div>
            <div className="text-xl font-bold text-white">
              {playerId ? (
                <PlayerLink playerId={playerId}>{getFirstName(stat.playerName)}</PlayerLink>
              ) : (
                getFirstName(stat.playerName)
              )}
            </div>
            <div className="text-lg text-gray-300 mt-1">{stat.value}</div>
            {stat.hint && (
              <div className="pointer-events-none absolute left-3 right-3 -top-2 translate-y-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="rounded-lg bg-black/80 border border-gray-700 px-3 py-2 text-xs text-gray-200 shadow-lg">
                  {stat.hint}
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
