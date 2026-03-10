import { Player, Game, PlayerStats, FunStat, GamesAgainstStats, GamesAgainstBucket } from '../types';

export function calculatePlayerStats(
  player: Player,
  games: Game[]
): PlayerStats {
  const playerGames = games.filter(game => game.results[player.id] !== undefined);
  const results = playerGames.map(game => game.results[player.id]);
  
  const totalWinnings = results.reduce((sum, val) => sum + val, 0);
  const gamesPlayed = playerGames.length;
  const averagePerGame = gamesPlayed > 0 ? totalWinnings / gamesPlayed : 0;
  
  const biggestWin = Math.max(...results, 0);
  const biggestLoss = Math.min(...results, 0);
  
  const wins = results.filter(r => r > 0).length;
  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  
  // Population standard deviation of per-game results (cents): σ = sqrt(Σ(x_i - μ)² / n)
  const mean = averagePerGame;
  const variance =
    gamesPlayed > 0
      ? results.reduce((sum, val) => sum + (val - mean) ** 2, 0) / gamesPlayed
      : 0;
  const standardDeviation = Math.sqrt(variance);
  
  // Recent trend (last 5 games)
  const recentGames = playerGames.slice(-5);
  const recentResults = recentGames.map(g => g.results[player.id]);
  const recentTotal = recentResults.reduce((sum, val) => sum + val, 0);
  let recentTrend: 'hot' | 'cold' | 'neutral' = 'neutral';
  if (recentTotal > 1000) recentTrend = 'hot';
  else if (recentTotal < -1000) recentTrend = 'cold';
  
  return {
    playerId: player.id,
    playerName: player.name,
    totalWinnings,
    gamesPlayed,
    averagePerGame,
    biggestWin,
    biggestLoss,
    winPercentage,
    standardDeviation,
    recentTrend,
  };
}

export function getPlayerStreaks(
  playerId: string,
  games: Game[]
): { longestWinning: number; longestLosing: number } {
  const playerGames = games
    .filter((g) => g.results[playerId] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));
  let longestWinning = 0;
  let longestLosing = 0;
  let currentWin = 0;
  let currentLose = 0;
  for (const g of playerGames) {
    const result = g.results[playerId] ?? 0;
    if (result > 0) {
      currentWin++;
      longestWinning = Math.max(longestWinning, currentWin);
      currentLose = 0;
    } else if (result < 0) {
      currentLose++;
      longestLosing = Math.max(longestLosing, currentLose);
      currentWin = 0;
    } else {
      currentWin = 0;
      currentLose = 0;
    }
  }
  return { longestWinning, longestLosing };
}

function bucketFromResults(results: number[]): GamesAgainstBucket {
  const gamesPlayed = results.length;
  const totalWinnings = results.reduce((sum, val) => sum + val, 0);
  const averagePerGame = gamesPlayed > 0 ? totalWinnings / gamesPlayed : 0;
  const wins = results.filter((r) => r > 0).length;
  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  return { gamesPlayed, totalWinnings, averagePerGame, winPercentage };
}

/**
 * Returns the focal player's stats in games where the opponent played vs games where they did not.
 */
export function getGamesAgainstVsWithout(
  playerId: string,
  opponentId: string,
  games: Game[]
): GamesAgainstStats {
  const gamesAgainst = games.filter(
    (g) => g.results[playerId] !== undefined && g.results[opponentId] !== undefined
  );
  const gamesWithout = games.filter(
    (g) => g.results[playerId] !== undefined && g.results[opponentId] === undefined
  );
  const resultsAgainst = gamesAgainst.map((g) => g.results[playerId] ?? 0);
  const resultsWithout = gamesWithout.map((g) => g.results[playerId] ?? 0);
  return {
    gamesAgainst: bucketFromResults(resultsAgainst),
    gamesWithout: bucketFromResults(resultsWithout),
  };
}

/** Min games for "meaningful" totals (Whale, Shark, single-game stats, etc.). */
const MIN_GAMES_FOR_TOTALS = 3;
/** Min games for streak / volatility stats so one-timers don't dominate. */
const MIN_GAMES_FOR_STREAKS = 5;
export function calculateFunStats(players: Player[], games: Game[]): FunStat[] {
  const allStats = players.map(p => calculatePlayerStats(p, games));
  const totalGames = games.length;

  if (allStats.length === 0) return [];

  const funStats: FunStat[] = [];
  const withMinGames = allStats.filter((s) => s.gamesPlayed >= MIN_GAMES_FOR_TOTALS);

  // The Shark - biggest all-time winner
  if (withMinGames.length > 0) {
    const shark = withMinGames.reduce((max, stat) =>
      stat.totalWinnings > max.totalWinnings ? stat : max
    );
    funStats.push({
      title: '🦈 The Shark',
      description: 'Biggest all-time winner',
      playerName: shark.playerName,
      value: formatCurrency(shark.totalWinnings),
      hint: `Among players with at least ${MIN_GAMES_FOR_TOTALS} games.`,
    });
  }

  // The Whale - biggest all-time loser (min games so one-timer doesn't win)
  if (withMinGames.length > 0) {
    const whale = withMinGames.reduce((min, stat) =>
      stat.totalWinnings < min.totalWinnings ? stat : min
    );
    funStats.push({
      title: '🐋 The Whale',
      description: 'Biggest all-time loser',
      playerName: whale.playerName,
      value: formatCurrency(whale.totalWinnings),
      hint: `Among players with at least ${MIN_GAMES_FOR_TOTALS} games.`,
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
  const ironButtPct = totalGames > 0 ? ((ironButt.gamesPlayed / totalGames) * 100).toFixed(0) : '0';
  funStats.push({
    title: '🪑 Iron Butt',
    description: 'Most games played',
    playerName: ironButt.playerName,
    value: `${ironButt.gamesPlayed} game${ironButt.gamesPlayed !== 1 ? 's' : ''} (${ironButtPct}%)`,
  });

  const withEnoughGames = allStats.filter((s) => s.gamesPlayed >= MIN_GAMES_FOR_TOTALS);
  
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
      hint: `Share of games finished in the black (min ${MIN_GAMES_FOR_TOTALS} games).`,
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
      hint: `Share of games finished in the black (min ${MIN_GAMES_FOR_TOTALS} games).`,
    });
  }
  
  // Biggest Single-Game Winner (min games so one big win by a newcomer doesn't dominate)
  if (withMinGames.length > 0) {
    const biggestSingleGameWinner = withMinGames.reduce((max, stat) => {
      const maxRecovery = Math.max(stat.biggestWin, 0);
      const currentMax = Math.max(max.biggestWin, 0);
      return maxRecovery > currentMax ? stat : max;
    });
    if (biggestSingleGameWinner.biggestWin > 0) {
      funStats.push({
        title: '🎯 Biggest Single-Game Winner',
        description: 'Largest single-game win',
        playerName: biggestSingleGameWinner.playerName,
        value: formatCurrency(biggestSingleGameWinner.biggestWin),
        hint: `Among players with at least ${MIN_GAMES_FOR_TOTALS} games.`,
      });
    }
  }

  // The Biggest Loser (min games so one bad night by a newcomer doesn't dominate)
  if (withMinGames.length > 0) {
    const biggestSingleGameLoser = withMinGames.reduce((min, stat) =>
      stat.biggestLoss < min.biggestLoss ? stat : min
    );
    funStats.push({
      title: '💸 The Biggest Loser',
      description: 'Largest single-game loss',
      playerName: biggestSingleGameLoser.playerName,
      value: formatCurrency(biggestSingleGameLoser.biggestLoss),
      hint: `Among players with at least ${MIN_GAMES_FOR_TOTALS} games.`,
    });
  }

  // Streak Master - longest winning streak (min games so 1-game "streak" doesn't win)
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
  const withStreakMin = allStats.filter((s) => s.gamesPlayed >= MIN_GAMES_FOR_STREAKS);
  if (withStreakMin.length > 0) {
    const streakMaster = withStreakMin.reduce((max, stat) =>
      getLongestWinningStreak(stat) > getLongestWinningStreak(max) ? stat : max
    );
    const streakCount = getLongestWinningStreak(streakMaster);
    if (streakCount > 0) {
      funStats.push({
        title: '⚡ Streak Master',
        description: 'Longest winning streak',
        playerName: streakMaster.playerName,
        value: `${streakCount} game${streakCount !== 1 ? 's' : ''} in a row`,
        hint: `Most consecutive wins (min ${MIN_GAMES_FOR_STREAKS} games played).`,
      });
    }
  }

  // Cold Streak - longest losing streak (min games for meaningful streak)
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
  if (withStreakMin.length > 0) {
    const coldStreak = withStreakMin.reduce((max, stat) =>
      getLongestLosingStreak(stat) > getLongestLosingStreak(max) ? stat : max
    );
    const coldStreakCount = getLongestLosingStreak(coldStreak);
    if (coldStreakCount > 0) {
      funStats.push({
        title: '❄️ Longest Cold Streak',
        description: 'Most consecutive losses',
        playerName: coldStreak.playerName,
        value: `${coldStreakCount} game${coldStreakCount !== 1 ? 's' : ''} in a row`,
        hint: `Most consecutive losses (min ${MIN_GAMES_FOR_STREAKS} games played).`,
      });
    }
  }

  // On Fire - best average over a player's last 5 games, considering only the last 20 games played (min 3 in window)
  const last20Games = [...games].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const withLast5InWindow = allStats
    .filter((s) => s.gamesPlayed >= 3)
    .map((stat) => {
      const playerGamesInWindow = last20Games.filter((g) => g.results[stat.playerId] !== undefined);
      if (playerGamesInWindow.length < 3) return null;
      const last5InWindow = playerGamesInWindow.slice(0, 5);
      const total = last5InWindow.reduce((sum, g) => sum + (g.results[stat.playerId] ?? 0), 0);
      return { stat, last5Avg: total / last5InWindow.length };
    })
    .filter((x): x is { stat: PlayerStats; last5Avg: number } => x !== null);
  if (withLast5InWindow.length > 0) {
    const onFire = withLast5InWindow.reduce((best, curr) => (curr.last5Avg > best.last5Avg ? curr : best));
    funStats.push({
      title: '🔥 On Fire',
      description: 'Best recent form (last 5 games)',
      playerName: onFire.stat.playerName,
      value: formatCurrency(Math.round(onFire.last5Avg)),
      hint: 'Highest average over their last 5 games, among the 20 most recent games played.',
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

  // The Tortoise - among players up overall, the smallest average per-game win (steady, slow gains)
  const upOverall = withMinGames.filter((s) => s.totalWinnings > 0);
  if (upOverall.length > 0) {
    const tortoise = upOverall.reduce((best, stat) =>
      stat.averagePerGame < best.averagePerGame ? stat : best
    );
    funStats.push({
      title: '🐢 The Tortoise',
      description: 'Up overall with the smallest avg per game',
      playerName: tortoise.playerName,
      value: formatCurrency(Math.round(tortoise.averagePerGame)),
      hint: `Among players in the black. Wins slowly and steadily—no big swings.`,
    });
  }

  // On Vacation - highest attendance % among players who haven't played in the last 5 games
  const last5Games = [...games].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const playedInLast5 = new Set<string>();
  for (const g of last5Games) {
    for (const playerId of Object.keys(g.results)) {
      playedInLast5.add(playerId);
    }
  }
  if (totalGames >= 5 && last5Games.length === 5) {
    const onVacationEligible = allStats.filter(
      (s) => s.gamesPlayed >= MIN_GAMES_FOR_TOTALS && !playedInLast5.has(s.playerId)
    );
    if (onVacationEligible.length > 0) {
      const onVacation = onVacationEligible.reduce((best, stat) =>
        stat.gamesPlayed / totalGames > best.gamesPlayed / totalGames ? stat : best
      );
      const gamesByDateDesc = [...games].sort((a, b) => b.date.localeCompare(a.date));
      let missedInARow = 0;
      for (const g of gamesByDateDesc) {
        if (g.results[onVacation.playerId] !== undefined) break;
        missedInARow++;
      }
      funStats.push({
        title: '🏖️ On Vacation',
        description: 'Highest attendance % but MIA for recent games',
        playerName: onVacation.playerName,
        value: `${missedInARow} game${missedInARow !== 1 ? 's' : ''} missed in a row`,
        hint: 'Used to be a regular—counting how many most-recent games they’ve skipped.',
      });
    }
  }

  // Runner-Up - most 2nd place finishes (2nd-highest result in a game)
  const secondPlaceCounts = new Map<string, number>();
  for (const game of games) {
    const sorted = Object.entries(game.results)
      .map(([id, cents]) => ({ id, cents }))
      .sort((a, b) => b.cents - a.cents);
    if (sorted.length >= 2) {
      const secondId = sorted[1].id;
      secondPlaceCounts.set(secondId, (secondPlaceCounts.get(secondId) ?? 0) + 1);
    }
  }
  const runnerUpEligible = allStats.filter((s) => s.gamesPlayed >= MIN_GAMES_FOR_TOTALS);
  if (runnerUpEligible.length > 0) {
    let bestSecondCount = 0;
    let runnerUpStat: PlayerStats | null = null;
    for (const stat of runnerUpEligible) {
      const count = secondPlaceCounts.get(stat.playerId) ?? 0;
      if (count > bestSecondCount) {
        bestSecondCount = count;
        runnerUpStat = stat;
      }
    }
    if (runnerUpStat && bestSecondCount > 0) {
      funStats.push({
        title: '🥈 Runner-Up',
        description: 'Most 2nd place finishes',
        playerName: runnerUpStat.playerName,
        value: `${bestSecondCount} time${bestSecondCount !== 1 ? 's' : ''}`,
        hint: `Finished with the 2nd-highest result in a game more than anyone else (min ${MIN_GAMES_FOR_TOTALS} games).`,
      });
    }
  }

  // What's The Point - smallest non-zero result in any single game (only among players with min games)
  const playerIdToGames = new Map<string, number>();
  for (const g of games) {
    for (const playerId of Object.keys(g.results)) {
      playerIdToGames.set(playerId, (playerIdToGames.get(playerId) ?? 0) + 1);
    }
  }
  let whatsThePointValue: number | null = null;
  let whatsThePointPlayerName: string | null = null;
  for (const game of games) {
    for (const [playerId, cents] of Object.entries(game.results)) {
      if (cents === 0 || (playerIdToGames.get(playerId) ?? 0) < MIN_GAMES_FOR_TOTALS) continue;
      const abs = Math.abs(cents);
      if (whatsThePointValue === null || abs < whatsThePointValue) {
        whatsThePointValue = abs;
        const p = players.find((x) => x.id === playerId);
        whatsThePointPlayerName = p ? p.name : null;
      }
    }
  }
  if (whatsThePointValue !== null && whatsThePointPlayerName) {
    funStats.push({
      title: '❓ What\'s The Point',
      description: 'Closest to break-even in a single game',
      playerName: whatsThePointPlayerName,
      value: formatCurrency(whatsThePointValue > 0 ? whatsThePointValue : -whatsThePointValue),
      hint: `Smallest non-zero result in one game (min ${MIN_GAMES_FOR_TOTALS} games played).`,
    });
  }

  // The Eliminator - largest margin of victory in a single game (no min games)
  let eliminatorMargin = 0;
  let eliminatorWinnerName: string | null = null;
  for (const game of games) {
    const sorted = Object.entries(game.results)
      .map(([id, c]) => ({ id, cents: c }))
      .sort((a, b) => b.cents - a.cents);
    if (sorted.length >= 2) {
      const margin = sorted[0].cents - sorted[1].cents;
      if (margin > eliminatorMargin) {
        eliminatorMargin = margin;
        const p = players.find((x) => x.id === sorted[0].id);
        eliminatorWinnerName = p ? p.name : null;
      }
    }
  }
  if (eliminatorMargin > 0 && eliminatorWinnerName) {
    funStats.push({
      title: '👊 The Eliminator',
      description: 'Biggest margin of victory in one game',
      playerName: eliminatorWinnerName,
      value: formatCurrency(eliminatorMargin),
      hint: 'Won one game by the largest gap over 2nd place.',
    });
  }

  // Mr. Positive - most games with a positive result (min games so "most wins" is meaningful)
  const winCounts = withMinGames.map((stat) => {
    const count = games.filter((g) => (g.results[stat.playerId] ?? 0) > 0).length;
    return { stat, count };
  });
  if (winCounts.length > 0) {
    const mrPositive = winCounts.reduce((best, curr) => (curr.count > best.count ? curr : best));
    if (mrPositive.count > 0) {
      funStats.push({
        title: '😄 Mr. Positive',
        description: 'Most winning sessions',
        playerName: mrPositive.stat.playerName,
        value: `${mrPositive.count} game${mrPositive.count !== 1 ? 's' : ''} in the green`,
        hint: `Among players with at least ${MIN_GAMES_FOR_TOTALS} games.`,
      });
    }
  }

  // Comeback Kid / He Fell Off - biggest change in average take-home over the last 25 games (early vs recent half)
  const last25Games = [...games].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
  const minGamesInWindow = 8;
  const windowCandidates: {
    playerName: string;
    earlyAvg: number;
    recentAvg: number;
    change: number; // recent - early (positive = improvement, negative = fell off)
  }[] = [];
  for (const stat of allStats) {
    const playerGamesInWindow = last25Games
      .filter((g) => g.results[stat.playerId] !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));
    const played = playerGamesInWindow.length;
    if (played < minGamesInWindow) continue;
    const half = Math.floor(played / 2);
    const earlyGames = playerGamesInWindow.slice(0, half);
    const recentGames = playerGamesInWindow.slice(half);
    const earlySum = earlyGames.reduce((s, g) => s + (g.results[stat.playerId] ?? 0), 0);
    const recentSum = recentGames.reduce((s, g) => s + (g.results[stat.playerId] ?? 0), 0);
    const earlyAvg = earlySum / earlyGames.length;
    const recentAvg = recentSum / recentGames.length;
    const change = recentAvg - earlyAvg;
    windowCandidates.push({ playerName: stat.playerName, earlyAvg, recentAvg, change });
  }
  // Comeback Kid - biggest improvement (positive change)
  const comebackCandidates = windowCandidates.filter((c) => c.change > 0);
  if (comebackCandidates.length > 0) {
    const comeback = comebackCandidates.reduce((best, c) => (c.change > best.change ? c : best));
    funStats.push({
      title: '📈 Comeback Kid',
      description: 'Biggest improvement in avg take-home (last 25 games)',
      playerName: comeback.playerName,
      value: `${formatCurrency(Math.round(comeback.earlyAvg))}/game → ${formatCurrency(Math.round(comeback.recentAvg))}/game`,
      hint: `Among the last 25 games. Avg per game improved by ${formatCurrency(Math.round(comeback.change))}. Min ${minGamesInWindow} games in window.`,
    });
  }
  // He Fell Off - biggest decline (negative change)
  const fellOffCandidates = windowCandidates.filter((c) => c.change < 0);
  if (fellOffCandidates.length > 0) {
    const fellOff = fellOffCandidates.reduce((best, c) => (c.change < best.change ? c : best));
    funStats.push({
      title: '📉 He Fell Off',
      description: 'Biggest drop in avg take-home (last 25 games)',
      playerName: fellOff.playerName,
      value: `${formatCurrency(Math.round(fellOff.earlyAvg))}/game → ${formatCurrency(Math.round(fellOff.recentAvg))}/game`,
      hint: `Among the last 25 games. Avg per game dropped by ${formatCurrency(Math.round(-fellOff.change))}. Min ${minGamesInWindow} games in window.`,
    });
  }

  // Consistency King - smallest std deviation (at end)
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
      hint: `Lowest standard deviation of per-game results (min ${MIN_GAMES_FOR_TOTALS} games).`,
    });
  }

  // Rollercoaster - largest std deviation (at end)
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
      hint: `Highest standard deviation of per-game results (min ${MIN_GAMES_FOR_TOTALS} games).`,
    });
  }

  return funStats;
}

export function formatCurrency(cents: number): string {
  const dollars = cents / 100;
  if (dollars < 0) return `-$${Math.abs(dollars).toFixed(2)}`;
  return `${dollars > 0 ? '+' : ''}$${dollars.toFixed(2)}`;
}

/** First word of name only; used for display everywhere except Lifetime Standings. */
export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
