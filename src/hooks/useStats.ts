import { useMemo } from 'react';
import { Player, Game } from '../types';
import { calculatePlayerStats, calculateFunStats } from '../lib/statsCalculator';

export function useStats(players: Player[], games: Game[]) {
  const playerStats = useMemo(() => {
    return players.map(player => calculatePlayerStats(player, games));
  }, [players, games]);

  const funStats = useMemo(() => {
    return calculateFunStats(players, games);
  }, [players, games]);

  const lifetimeStandings = useMemo(() => {
    return [...playerStats]
      .filter(stat => stat.gamesPlayed > 0)
      .sort((a, b) => b.totalWinnings - a.totalWinnings);
  }, [playerStats]);

  return {
    playerStats,
    funStats,
    lifetimeStandings,
  };
}
