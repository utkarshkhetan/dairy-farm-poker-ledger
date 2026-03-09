import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Player, Game } from '../types';
import { formatCurrency, getFirstName } from '../lib/statsCalculator';
import { PlayerLink } from './PlayerLink';

const LINE_CHART_HEIGHT = 880;

const PLOT_MARGIN = { left: 60, right: 30, top: 20, bottom: 60 };

function getClosestPoint(
  mouseX: number,
  mouseY: number,
  data: Array<Record<string, unknown>>,
  playerNames: string[],
  chartWidth: number,
  chartHeight: number,
  yMin: number,
  yMax: number
): { date: string; playerName: string; value: number } | null {
  const plotWidth = chartWidth - PLOT_MARGIN.left - PLOT_MARGIN.right;
  const plotHeight = chartHeight - PLOT_MARGIN.top - PLOT_MARGIN.bottom;
  const plotX = mouseX - PLOT_MARGIN.left;
  const plotY = mouseY - PLOT_MARGIN.top;
  if (plotX < 0 || plotX > plotWidth || plotY < 0 || plotY > plotHeight) return null;
  const n = data.length;
  if (n === 0) return null;
  const yRange = yMax - yMin || 1;
  let best: { date: string; playerName: string; value: number } | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < n; i++) {
    const row = data[i];
    const date = String(row.date ?? '');
    for (const name of playerNames) {
      const v = row[name];
      if (v == null || typeof v !== 'number') continue;
      const px = PLOT_MARGIN.left + (n === 1 ? 0.5 : i / (n - 1)) * plotWidth;
      const py = PLOT_MARGIN.top + (1 - (v - yMin) / yRange) * plotHeight;
      const d = (mouseX - px) ** 2 + (mouseY - py) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = { date, playerName: name, value: v };
      }
    }
  }
  return best;
}

function getYExtent(data: Array<Record<string, unknown>>, playerNames: string[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const row of data) {
    for (const name of playerNames) {
      const v = row[name];
      if (typeof v === 'number') {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  return { min, max };
}

interface ChartsSectionProps {
  players: Player[];
  games: Game[];
}

export function ChartsSection({ players, games }: ChartsSectionProps) {
  const navigate = useNavigate();
  const [activeLineCumulative, setActiveLineCumulative] = useState<string | null>(null);
  const [activeLineAverage, setActiveLineAverage] = useState<string | null>(null);
  const [barRange, setBarRange] = useState<'week' | 'month' | 'quarter'>('quarter');
  const [cumulativeChartWidth, setCumulativeChartWidth] = useState(0);
  const [averageChartWidth, setAverageChartWidth] = useState(0);
  const [cumulativeMouse, setCumulativeMouse] = useState<{ x: number; y: number } | null>(null);
  const [averageMouse, setAverageMouse] = useState<{ x: number; y: number } | null>(null);
  const cumulativeContainerRef = useRef<HTMLDivElement>(null);
  const averageContainerRef = useRef<HTMLDivElement>(null);
  const getGameDate = (dateStr: string) => new Date(`${dateStr.slice(0, 10)}T00:00:00`);

  const playersWithEnoughGames = useMemo(() => {
    const gameCount: Record<string, number> = {};
    for (const game of games) {
      for (const playerId of Object.keys(game.results)) {
        gameCount[playerId] = (gameCount[playerId] ?? 0) + 1;
      }
    }
    return players.filter((p) => (gameCount[p.id] ?? 0) >= 3);
  }, [players, games]);

  useEffect(() => {
    const el = cumulativeContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCumulativeChartWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = averageContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAverageChartWidth(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const handleCumulativeMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCumulativeMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);
  const handleCumulativeMouseLeave = useCallback(() => {
    setCumulativeMouse(null);
    setActiveLineCumulative(null);
  }, []);
  const handleAverageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setAverageMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);
  const handleAverageMouseLeave = useCallback(() => {
    setAverageMouse(null);
    setActiveLineAverage(null);
  }, []);

  const cumulativeData = useMemo(() => {
    const sortedGames = [...games].sort((a, b) => a.date.localeCompare(b.date));
    const cumulative: Record<string, number> = {};
    const data: Array<Record<string, any>> = [];

    for (const game of sortedGames) {
      const entry: Record<string, any> = { date: game.displayDate };

      for (const player of players) {
        const result = game.results[player.id] || 0;
        cumulative[player.id] = (cumulative[player.id] || 0) + result;
        entry[player.name] = cumulative[player.id] / 100; // Convert to dollars
      }

      data.push(entry);
    }

    return data;
  }, [players, games]);

  const averageData = useMemo(() => {
    const sortedGames = [...games].sort((a, b) => a.date.localeCompare(b.date));
    const cumulative: Record<string, number> = {};
    const counts: Record<string, number> = {};
    const data: Array<Record<string, any>> = [];

    for (const game of sortedGames) {
      const entry: Record<string, any> = { date: game.displayDate };
      for (const player of playersWithEnoughGames) {
        const result = game.results[player.id];
        if (result !== undefined) {
          cumulative[player.id] = (cumulative[player.id] || 0) + result;
          counts[player.id] = (counts[player.id] || 0) + 1;
        }
        const count = counts[player.id] ?? 0;
        const avg = count > 0 ? cumulative[player.id]! / count : undefined;
        entry[player.name] = avg !== undefined ? avg / 100 : undefined;
      }
      data.push(entry);
    }

    return data;
  }, [playersWithEnoughGames, games]);

  const cumulativePlayerNames = useMemo(() => players.map((p) => p.name), [players]);
  const averagePlayerNames = useMemo(() => playersWithEnoughGames.map((p) => p.name), [playersWithEnoughGames]);
  const cumulativeYExtent = useMemo(() => getYExtent(cumulativeData, cumulativePlayerNames), [cumulativeData, cumulativePlayerNames]);
  const averageYExtent = useMemo(() => getYExtent(averageData, averagePlayerNames), [averageData, averagePlayerNames]);
  const cumulativeClosest = useMemo(() => {
    if (!cumulativeMouse || cumulativeChartWidth <= 0) return null;
    return getClosestPoint(
      cumulativeMouse.x,
      cumulativeMouse.y,
      cumulativeData,
      cumulativePlayerNames,
      cumulativeChartWidth,
      LINE_CHART_HEIGHT,
      cumulativeYExtent.min,
      cumulativeYExtent.max
    );
  }, [cumulativeMouse, cumulativeChartWidth, cumulativeData, cumulativePlayerNames, cumulativeYExtent]);
  const averageClosest = useMemo(() => {
    if (!averageMouse || averageChartWidth <= 0) return null;
    return getClosestPoint(
      averageMouse.x,
      averageMouse.y,
      averageData,
      averagePlayerNames,
      averageChartWidth,
      LINE_CHART_HEIGHT,
      averageYExtent.min,
      averageYExtent.max
    );
  }, [averageMouse, averageChartWidth, averageData, averagePlayerNames, averageYExtent]);

  useEffect(() => {
    setActiveLineCumulative(cumulativeClosest?.playerName ?? null);
  }, [cumulativeClosest?.playerName]);
  useEffect(() => {
    setActiveLineAverage(averageClosest?.playerName ?? null);
  }, [averageClosest?.playerName]);

  const barRangeDays: Record<'week' | 'month' | 'quarter', number> = {
    week: 7,
    month: 30,
    quarter: 90,
  };

  const barRangeLabels: Record<'week' | 'month' | 'quarter', string> = {
    week: 'Last 7 days',
    month: 'Last 30 days',
    quarter: 'Last 90 days',
  };

  const renderLegend = useCallback(
    (props: { payload?: Array<{ value?: string; color?: string }> }) => {
      if (!props.payload) return null;
      return (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2" style={{ color: '#9ca3af' }}>
          {props.payload.map((entry, index) => {
            const value = entry.value ?? '';
            const player = players.find((p) => p.name === value);
            if (!player) return <span key={index}>{getFirstName(value)}</span>;
            return (
              <PlayerLink key={player.id} playerId={player.id} className="inline-flex items-center gap-1.5">
                <span style={{ display: 'inline-block', width: 12, height: 3, backgroundColor: entry.color ?? '#9ca3af' }} />
                {getFirstName(value)}
              </PlayerLink>
            );
          })}
        </div>
      );
    },
    [players]
  );

  const playerTotalsData = useMemo(() => {
    if (games.length === 0) return [];
    const anchorDate = games.reduce((latest, game) => {
      const d = getGameDate(game.date);
      return d > latest ? d : latest;
    }, new Date('1970-01-01T00:00:00'));
    const cutoff = new Date(anchorDate.getTime() - barRangeDays[barRange] * 24 * 60 * 60 * 1000);
    const periodGames = games.filter((g) => getGameDate(g.date) >= cutoff);

    return players.map((player) => {
      const total = periodGames.reduce((sum, game) => {
        const result = game.results[player.id];
        return sum + (result ?? 0);
      }, 0);
      return { player: getFirstName(player.name), total: total / 100, playerId: player.id };
    });
  }, [players, games, barRange]);

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-4">📈 Profit/Loss Over Time</h2>
      <div
        ref={cumulativeContainerRef}
        className="mb-6 relative"
        onMouseMove={handleCumulativeMouseMove}
        onMouseLeave={handleCumulativeMouseLeave}
      >
        <ResponsiveContainer width="100%" height={880}>
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value}`} domain={['dataMin', 'dataMax']} />
            <Tooltip content={() => null} />
            <Legend content={renderLegend} />
            {players.map((player, index) => {
              const color = `hsl(${(index * 360) / Math.max(players.length, 1)}, 70%, 50%)`;
              const dimmed = activeLineCumulative && activeLineCumulative !== player.name;
              return (
                <Line
                  key={player.id}
                  type="monotone"
                  dataKey={player.name}
                  stroke={color}
                  strokeWidth={dimmed ? 1 : 3}
                  strokeOpacity={dimmed ? 0.15 : 1}
                  dot={false}
                  activeDot={{ r: 8 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        {cumulativeMouse && cumulativeClosest && (() => {
          const player = players.find((p) => p.name === cumulativeClosest.playerName);
          const color = player ? `hsl(${(Math.max(0, players.findIndex((p) => p.name === cumulativeClosest.playerName)) * 360) / Math.max(players.length, 1)}, 70%, 50%)` : '#9ca3af';
          return (
          <div
            className="absolute z-10 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-200 shadow-lg"
            style={{ left: cumulativeMouse.x + 12, top: cumulativeMouse.y + 12 }}
          >
            <div className="mb-1 text-gray-400">{cumulativeClosest.date}</div>
            <div className="flex items-center justify-between gap-3">
              <span style={{ color }}>
                {player ? (
                  <PlayerLink playerId={player.id}>{getFirstName(cumulativeClosest.playerName)}</PlayerLink>
                ) : (
                  getFirstName(cumulativeClosest.playerName)
                )}
              </span>
              <span>{formatCurrency(cumulativeClosest.value * 100)}</span>
            </div>
          </div>
          );
        })()}
      </div>

      <div className="border-t border-gray-700 pt-5 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-lg font-semibold text-white">Player Win/Loss Totals</h3>
          <div className="flex items-center gap-2 text-xs">
            {(['week', 'month', 'quarter'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setBarRange(option)}
                className={`px-2.5 py-1 rounded-md border transition-all ${
                  barRange === option
                    ? 'bg-blue-600/40 border-blue-500 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {barRangeLabels[option]}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={playerTotalsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="player" stroke="#9ca3af" angle={-85} textAnchor="end" height={90} interval={0} />
            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: number) => formatCurrency(value * 100)}
            />
            <Bar dataKey="total" fill="#60a5fa" cursor="pointer">
              {playerTotalsData.map((entry) => (
                <Cell
                  key={entry.playerId}
                  fill={entry.total >= 0 ? '#34d399' : '#f87171'}
                  onClick={() => navigate(`/player/${entry.playerId}`)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-gray-700 pt-5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-1">Average Profit/Loss Per Game</h3>
        <p className="text-sm text-gray-400 mb-3">Only players with 3+ games shown</p>
        <div
          ref={averageContainerRef}
          className="relative"
          onMouseMove={handleAverageMouseMove}
          onMouseLeave={handleAverageMouseLeave}
        >
          <ResponsiveContainer width="100%" height={880}>
            <LineChart data={averageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value}`} domain={['dataMin', 'dataMax']} />
              <Tooltip content={() => null} />
              <Legend content={renderLegend} />
              {playersWithEnoughGames.map((player, index) => {
                const color = `hsl(${(index * 360) / Math.max(playersWithEnoughGames.length, 1)}, 70%, 50%)`;
                const dimmed = activeLineAverage && activeLineAverage !== player.name;
                return (
                  <Line
                    key={player.id}
                    type="monotone"
                    dataKey={player.name}
                    stroke={color}
                    strokeWidth={dimmed ? 1 : 2.5}
                    strokeOpacity={dimmed ? 0.15 : 0.95}
                    dot={false}
                    activeDot={{ r: 8 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
          {averageMouse && averageClosest && (() => {
            const player = playersWithEnoughGames.find((p) => p.name === averageClosest.playerName);
            const color = player ? `hsl(${(Math.max(0, playersWithEnoughGames.findIndex((p) => p.name === averageClosest.playerName)) * 360) / Math.max(playersWithEnoughGames.length, 1)}, 70%, 50%)` : '#9ca3af';
            return (
            <div
              className="absolute z-10 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-200 shadow-lg"
              style={{ left: averageMouse.x + 12, top: averageMouse.y + 12 }}
            >
              <div className="mb-1 text-gray-400">{averageClosest.date}</div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color }}>
                  {player ? (
                    <PlayerLink playerId={player.id}>{getFirstName(averageClosest.playerName)}</PlayerLink>
                  ) : (
                    getFirstName(averageClosest.playerName)
                  )}
                </span>
                <span>{formatCurrency(averageClosest.value * 100)}</span>
              </div>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
