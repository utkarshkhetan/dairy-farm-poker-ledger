import { Player, Game, PlayerStats, FunStat } from '../types';

export function calculatePlayerStats(
  player: Player,
  games: Game[]
): PlayerStats {
  const getGameDate = (dateStr: string) => new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const playerGames = games.filter(game => game.results[player.id] !== undefined);
  const results = playerGames.map(game => game.results[player.id]);
  
  const totalWinnings = results.reduce((sum, val) => sum + val, 0);
  const gamesPlayed = playerGames.length;
  const averagePerGame = gamesPlayed > 0 ? totalWinnings / gamesPlayed : 0;
  
  const biggestWin = Math.max(...results, 0);
  const biggestLoss = Math.min(...results, 0);
  
  const wins = results.filter(r => r > 0).length;
  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  
  // Calculate standard deviation
  const mean = averagePerGame;
  const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / gamesPlayed;
  const standardDeviation = gamesPlayed > 0 ? Math.sqrt(variance) : 0;
  
  // Recent trend (last 5 games)
  const recentGames = playerGames.slice(-5);
  const recentResults = recentGames.map(g => g.results[player.id]);
  const recentTotal = recentResults.reduce((sum, val) => sum + val, 0);
  let recentTrend: 'hot' | 'cold' | 'neutral' = 'neutral';
  if (recentTotal > 1000) recentTrend = 'hot';
  else if (recentTotal < -1000) recentTrend = 'cold';
  
  // Monthly trend (current month vs previous month)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const currentMonthGames = playerGames.filter(g => {
    const gameDate = getGameDate(g.date);
    return gameDate.getMonth() === currentMonth && gameDate.getFullYear() === currentYear;
  });
  
  const previousMonthGames = playerGames.filter(g => {
    const gameDate = getGameDate(g.date);
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return gameDate.getMonth() === prevMonth && gameDate.getFullYear() === prevYear;
  });
  
  const currentMonthTotal = currentMonthGames.reduce((sum, g) => sum + g.results[player.id], 0);
  const previousMonthTotal = previousMonthGames.reduce((sum, g) => sum + g.results[player.id], 0);
  const monthlyTrend = currentMonthTotal - previousMonthTotal;
  
  return {
    playerId: player.id,
    playerName: player.name,
    totalWinnings,
    gamesPlayed,
    gamesPlayedFromLedger: player.gamesPlayedFromLedger,
    averagePerGame,
    biggestWin,
    biggestLoss,
    winPercentage,
    standardDeviation,
    recentTrend,
    monthlyTrend,
  };
}

export function calculateFunStats(players: Player[], games: Game[]): FunStat[] {
  const allStats = players.map(p => calculatePlayerStats(p, games));
  
  if (allStats.length === 0) return [];
  
  const funStats: FunStat[] = [];
  
  // The Whale - biggest all-time loser
  const whale = allStats.reduce((min, stat) => 
    stat.totalWinnings < min.totalWinnings ? stat : min
  );
  funStats.push({
    title: '🐋 The Whale',
    description: 'Biggest all-time loser',
    playerName: whale.playerName,
    value: formatCurrency(whale.totalWinnings),
  });
  
  // The Shark - biggest all-time winner
  const shark = allStats.reduce((max, stat) => 
    stat.totalWinnings > max.totalWinnings ? stat : max
  );
  funStats.push({
    title: '🦈 The Shark',
    description: 'Biggest all-time winner',
    playerName: shark.playerName,
    value: formatCurrency(shark.totalWinnings),
  });
  
  // Consistency King - smallest std deviation
  const withEnoughGames = allStats.filter(s => s.gamesPlayed >= 3);
  const consistencyKing = withEnoughGames.length > 0
    ? withEnoughGames.reduce((min, stat) => 
        stat.standardDeviation < min.standardDeviation ? stat : min
      )
    : null;
  if (consistencyKing) {
    funStats.push({
      title: '👑 Consistency King',
      description: 'Most consistent results',
      playerName: consistencyKing.playerName,
      value: `σ = ${formatCurrency(consistencyKing.standardDeviation)}`,
      hint: 'Calculated by lowest standard deviation of per-game results (min 3 games).',
    });
  }
  
  // Rollercoaster - largest std deviation
  const rollercoaster = withEnoughGames.length > 0
    ? withEnoughGames.reduce((max, stat) => 
        stat.standardDeviation > max.standardDeviation ? stat : max
      )
    : null;
  if (rollercoaster) {
    funStats.push({
      title: '🎢 Rollercoaster',
      description: 'Most volatile results',
      playerName: rollercoaster.playerName,
      value: `σ = ${formatCurrency(rollercoaster.standardDeviation)}`,
      hint: 'Calculated by highest standard deviation of per-game results (min 3 games).',
    });
  }
  
  // Ghost Player - least games played
  const ghost = allStats.reduce((min, stat) => 
    stat.gamesPlayed < min.gamesPlayed ? stat : min
  );
  funStats.push({
    title: '👻 Ghost Player',
    description: 'Least games played',
    playerName: ghost.playerName,
    value: `${ghost.gamesPlayed} game${ghost.gamesPlayed !== 1 ? 's' : ''}`,
  });
  
  // Iron Butt - most games played
  const ironButt = allStats.reduce((max, stat) => 
    stat.gamesPlayed > max.gamesPlayed ? stat : max
  );
  funStats.push({
    title: '🪑 Iron Butt',
    description: 'Most games played',
    playerName: ironButt.playerName,
    value: `${ironButt.gamesPlayed} game${ironButt.gamesPlayed !== 1 ? 's' : ''}`,
  });
  
  // Lucky Charm - best winning %
  const luckyCharm = withEnoughGames.length > 0
    ? withEnoughGames.reduce((max, stat) => 
        stat.winPercentage > max.winPercentage ? stat : max
      )
    : null;
  if (luckyCharm) {
    funStats.push({
      title: '🍀 Lucky Charm',
      description: 'Best winning percentage',
      playerName: luckyCharm.playerName,
      value: `${luckyCharm.winPercentage.toFixed(1)}%`,
    });
  }
  
  // Unlucky Soul - worst winning %
  const unluckySoul = withEnoughGames.length > 0
    ? withEnoughGames.reduce((min, stat) => 
        stat.winPercentage < min.winPercentage ? stat : min
      )
    : null;
  if (unluckySoul) {
    funStats.push({
      title: '💀 Unlucky Soul',
      description: 'Worst winning percentage',
      playerName: unluckySoul.playerName,
      value: `${unluckySoul.winPercentage.toFixed(1)}%`,
    });
  }
  
  // Biggest Single-Game Winner
  const biggestSingleGameWinner = allStats.reduce((max, stat) => {
    const maxRecovery = Math.max(stat.biggestWin, 0);
    const currentMax = Math.max(max.biggestWin, 0);
    return maxRecovery > currentMax ? stat : max;
  });
  funStats.push({
    title: '🎯 Biggest Single-Game Winner',
    description: 'Largest single-game win',
    playerName: biggestSingleGameWinner.playerName,
    value: formatCurrency(biggestSingleGameWinner.biggestWin),
  });

  // Streak Master - longest winning streak
  const getLongestWinningStreak = (stat: PlayerStats): number => {
    const playerGames = games
      .filter((g) => g.results[stat.playerId] !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    let maxStreak = 0;
    let currentStreak = 0;
    for (const g of playerGames) {
      const result = g.results[stat.playerId] ?? 0;
      if (result > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    return maxStreak;
  };
  const streakMaster = allStats.reduce((max, stat) =>
    getLongestWinningStreak(stat) > getLongestWinningStreak(max) ? stat : max
  );
  const streakCount = getLongestWinningStreak(streakMaster);
  if (streakCount > 0) {
    funStats.push({
      title: '🔥 Streak Master',
      description: 'Longest winning streak',
      playerName: streakMaster.playerName,
      value: `${streakCount} game${streakCount !== 1 ? 's' : ''} in a row`,
      hint: 'Most consecutive games with a positive result.',
    });
  }

  // Cold Streak - longest losing streak
  const getLongestLosingStreak = (stat: PlayerStats): number => {
    const playerGames = games
      .filter((g) => g.results[stat.playerId] !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    let maxStreak = 0;
    let currentStreak = 0;
    for (const g of playerGames) {
      const result = g.results[stat.playerId] ?? 0;
      if (result < 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    return maxStreak;
  };
  const coldStreak = allStats.reduce((max, stat) =>
    getLongestLosingStreak(stat) > getLongestLosingStreak(max) ? stat : max
  );
  const coldStreakCount = getLongestLosingStreak(coldStreak);
  if (coldStreakCount > 0) {
    funStats.push({
      title: '❄️ Longest Cold Streak',
      description: 'Most consecutive losses',
      playerName: coldStreak.playerName,
      value: `${coldStreakCount} game${coldStreakCount !== 1 ? 's' : ''} in a row`,
      hint: 'Most consecutive games with a negative result.',
    });
  }

  // Biggest Single-Game Loser
  const biggestSingleGameLoser = allStats.reduce((min, stat) =>
    stat.biggestLoss < min.biggestLoss ? stat : min
  );
  funStats.push({
    title: '💸 Biggest Single-Game Loser',
    description: 'Largest single-game loss',
    playerName: biggestSingleGameLoser.playerName,
    value: formatCurrency(biggestSingleGameLoser.biggestLoss),
  });

  // On Fire - best average over last 5 games (min 3 played)
  const withLast5 = allStats
    .filter((s) => s.gamesPlayed >= 3)
    .map((stat) => {
      const playerGames = games
        .filter((g) => g.results[stat.playerId] !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-5);
      const total = playerGames.reduce((sum, g) => sum + (g.results[stat.playerId] ?? 0), 0);
      return { stat, last5Avg: total / playerGames.length };
    });
  if (withLast5.length > 0) {
    const onFire = withLast5.reduce((best, curr) => (curr.last5Avg > best.last5Avg ? curr : best));
    funStats.push({
      title: '🔥 On Fire',
      description: 'Best recent form (last 5 games)',
      playerName: onFire.stat.playerName,
      value: formatCurrency(Math.round(onFire.last5Avg)),
      hint: 'Highest average profit over their last 5 games.',
    });
  }

  // Last Laugh - winner of the most recent game
  const sortedGamesByDate = [...games].sort((a, b) => b.date.localeCompare(a.date));
  const mostRecentGame = sortedGamesByDate[0];
  if (mostRecentGame) {
    const entries = Object.entries(mostRecentGame.results) as [string, number][];
    const winnerEntry = entries.reduce<[string, number] | null>((best, [playerId, cents]) => {
      if (best === null || cents > best[1]) return [playerId, cents];
      return best;
    }, null);
    if (winnerEntry) {
      const [winnerId, winAmount] = winnerEntry;
      const winnerPlayer = players.find((p) => p.id === winnerId);
      if (winnerPlayer) {
        funStats.push({
          title: '😎 Last Laugh',
          description: 'Winner of the most recent game',
          playerName: winnerPlayer.name,
          value: formatCurrency(winAmount),
          hint: 'Took down the latest session.',
        });
      }
    }
  }

  return funStats;
}

export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars >= 0 ? '+' : '';
  return `${sign}$${dollars.toFixed(2)}`;
}
