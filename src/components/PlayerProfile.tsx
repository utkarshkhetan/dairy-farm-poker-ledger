import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePlayers, useGames, useStats } from '../hooks';
import { formatCurrency, getFirstName, getPlayerStreaks } from '../lib/statsCalculator';
import { PlayerLink } from './PlayerLink';

export function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const { players, loading: playersLoading, error: playersError } = usePlayers();
  const { games, loading: gamesLoading, error: gamesError } = useGames();
  const { lifetimeStandings, funStats, playerStats } = useStats(players, games);

  const player = useMemo(
    () => (playerId ? players.find((p) => p.id === playerId) : null),
    [players, playerId]
  );

  const stat = useMemo(
    () => (player ? playerStats.find((s) => s.playerId === player.id) : null),
    [player, playerStats]
  );

  const rank = useMemo(() => {
    if (!stat) return null;
    const index = lifetimeStandings.findIndex((s) => s.playerId === stat.playerId);
    return index >= 0 ? index + 1 : null;
  }, [stat, lifetimeStandings]);

  const playerGames = useMemo(() => {
    if (!player) return [];
    return games
      .filter((g) => g.results[player.id] !== undefined)
      .map((g) => ({
        game: g,
        cents: g.results[player.id] ?? 0,
        position: (() => {
          const entries = Object.entries(g.results)
            .map(([id, c]) => ({ id, cents: c }))
            .sort((a, b) => b.cents - a.cents);
          const idx = entries.findIndex((e) => e.id === player.id);
          return idx >= 0 ? idx + 1 : null;
        })(),
      }))
      .sort((a, b) => b.game.date.localeCompare(a.game.date));
  }, [player, games]);

  const cumulativeChartData = useMemo(() => {
    if (!player) return [];
    const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    return sorted
      .filter((g) => g.results[player.id] !== undefined)
      .map((g) => {
        running += g.results[player.id] ?? 0;
        return { date: g.displayDate, cumulative: running / 100 };
      });
  }, [player, games]);

  const streaks = useMemo(
    () => (playerId ? getPlayerStreaks(playerId, games) : { longestWinning: 0, longestLosing: 0 }),
    [playerId, games]
  );

  const opponents = useMemo(() => {
    if (!player) return [];
    const set = new Set<string>();
    for (const g of games) {
      if (g.results[player.id] === undefined) continue;
      for (const id of Object.keys(g.results)) {
        if (id !== player.id) set.add(id);
      }
    }
    return Array.from(set)
      .map((id) => players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [player, games, players]);

  const myFunStats = useMemo(
    () => (player ? funStats.filter((f) => f.playerName === player.name) : []),
    [player, funStats]
  );

  const loading = playersLoading || gamesLoading;
  const error = playersError || gamesError;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/" className="text-blue-400 hover:underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (!playerId || !player) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-white mb-2">Player not found</h1>
          <p className="text-gray-400 mb-4">No player exists with that ID.</p>
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">
            {player.name}
            {rank != null && (
              <span className="ml-3 text-lg font-normal text-gray-400">
                #{rank} in lifetime standings
              </span>
            )}
          </h1>
        </div>

        {/* Core stats */}
        {stat && (
          <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📊 Key statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Total winnings</div>
                <div className={`text-lg font-bold ${stat.totalWinnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(stat.totalWinnings)}
                </div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Games played</div>
                <div className="text-lg font-bold text-white">
                  {stat.gamesPlayed}
                  {stat.gamesPlayedFromLedger != null && stat.gamesPlayedFromLedger !== stat.gamesPlayed && (
                    <span className="text-gray-400 text-sm ml-1">(ledger: {stat.gamesPlayedFromLedger})</span>
                  )}
                </div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Avg per game</div>
                <div className={`text-lg font-bold ${stat.averagePerGame >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(stat.averagePerGame)}
                </div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Win %</div>
                <div className="text-lg font-bold text-white">{stat.winPercentage.toFixed(1)}%</div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Biggest win</div>
                <div className="text-lg font-bold text-green-400">{formatCurrency(stat.biggestWin)}</div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Biggest loss</div>
                <div className="text-lg font-bold text-red-400">{formatCurrency(stat.biggestLoss)}</div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Std deviation</div>
                <div className="text-lg font-bold text-white">{formatCurrency(Math.round(stat.standardDeviation))}</div>
              </div>
              <div className="bg-gray-900/70 rounded-lg p-4 border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Recent trend</div>
                <div
                  className={`text-lg font-bold capitalize ${
                    stat.recentTrend === 'hot'
                      ? 'text-red-500'
                      : stat.recentTrend === 'cold'
                        ? 'text-blue-400'
                        : 'text-gray-400'
                  }`}
                >
                  {stat.recentTrend}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Streaks */}
        <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">🔥 Streaks</h2>
          <div className="flex flex-wrap gap-4">
            <div className="bg-gray-900/70 rounded-lg px-4 py-3 border border-gray-700">
              <span className="text-gray-400 text-sm">Longest winning streak</span>
              <div className="text-lg font-bold text-green-400">
                {streaks.longestWinning} game{streaks.longestWinning !== 1 ? 's' : ''} in a row
              </div>
            </div>
            <div className="bg-gray-900/70 rounded-lg px-4 py-3 border border-gray-700">
              <span className="text-gray-400 text-sm">Longest losing streak</span>
              <div className="text-lg font-bold text-red-400">
                {streaks.longestLosing} game{streaks.longestLosing !== 1 ? 's' : ''} in a row
              </div>
            </div>
          </div>
        </div>

        {/* Fun stats they hold */}
        {myFunStats.length > 0 && (
          <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">🎲 Fun stats</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myFunStats.map((f, i) => (
                <div
                  key={i}
                  className="bg-gray-900/70 rounded-lg p-4 border border-gray-700"
                >
                  <div className="text-lg mb-1">{f.title}</div>
                  <div className="text-sm text-gray-400 mb-2">{f.description}</div>
                  <div className="text-xl font-bold text-white">{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cumulative P/L chart */}
        {cumulativeChartData.length > 0 && (
          <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📈 Cumulative profit/loss over time</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={cumulativeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" tickFormatter={(v) => formatCurrency(v * 100)} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value * 100), 'Cumulative']}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  name="Cumulative"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Played with */}
        {opponents.length > 0 && (
          <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">👥 Played with</h2>
            <p className="text-gray-400 text-sm mb-3">
              {opponents.length} distinct opponent{opponents.length !== 1 ? 's' : ''} in games you played.
            </p>
            <div className="flex flex-wrap gap-2">
              {opponents.map((p) => (
                <PlayerLink key={p.id} playerId={p.id}>
                  <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm">
                    {getFirstName(p.name)}
                  </span>
                </PlayerLink>
              ))}
            </div>
          </div>
        )}

        {/* Recent form */}
        {playerGames.length > 0 && (
          <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📋 Recent form (last 10 games)</h2>
            <div className="space-y-2">
              {playerGames.slice(0, 10).map(({ game, cents, position }) => (
                <div
                  key={game.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    cents >= 0 ? 'bg-green-900/20 border border-green-800/50' : 'bg-red-900/20 border border-red-800/50'
                  }`}
                >
                  <span className="text-gray-300">{game.displayDate}</span>
                  <span className="text-white">
                    {position != null && (
                      <span className="text-gray-400 mr-2">#{position}</span>
                    )}
                    <span className={cents >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                      {formatCurrency(cents)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full game history */}
        <div className="bg-gray-800/75 rounded-xl p-5 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">📋 Full game history</h2>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-800/75 border-b border-gray-700">
                <tr>
                  <th className="py-2 pr-4 text-gray-400 font-medium">Date</th>
                  <th className="py-2 pr-4 text-gray-400 font-medium">Position</th>
                  <th className="py-2 text-right text-gray-400 font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {playerGames.map(({ game, cents, position }) => (
                  <tr key={game.id} className="border-b border-gray-700/50">
                    <td className="py-2 pr-4">{game.displayDate}</td>
                    <td className="py-2 pr-4">{position != null ? `#${position}` : '—'}</td>
                    <td className={`py-2 text-right font-medium ${cents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
