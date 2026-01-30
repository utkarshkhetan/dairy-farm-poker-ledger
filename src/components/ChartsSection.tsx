import { useMemo, useState, useEffect } from 'react';
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
import { formatCurrency } from '../lib/statsCalculator';

const CHART_HEIGHT = 360;

function getClosestLineToCursor(
  payload: Array<{ dataKey: string; value?: number }>,
  coordinate: { x?: number; y?: number } | undefined,
  chartHeight: number
): string | null {
  if (!payload?.length || !coordinate || coordinate.y == null) return null;
  const validPayload = payload.filter((p) => p.value != null && typeof p.value === 'number');
  if (validPayload.length === 0) return null;
  const values = validPayload.map((p) => Number(p.value));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const cursorValue = minVal + (1 - coordinate.y / chartHeight) * range;
  let closest = validPayload[0];
  let minDist = Math.abs(Number(closest.value) - cursorValue);
  for (const p of validPayload) {
    const dist = Math.abs(Number(p.value) - cursorValue);
    if (dist < minDist) {
      minDist = dist;
      closest = p;
    }
  }
  return closest.dataKey as string;
}

interface ClosestLineTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value?: number; color?: string }>;
  label?: string;
  coordinate?: { x: number; y: number };
  setActiveLine: (name: string | null) => void;
  chartHeight: number;
}

function ClosestLineTooltip({
  active,
  payload,
  label,
  coordinate,
  setActiveLine,
  chartHeight,
}: ClosestLineTooltipProps) {
  useEffect(() => {
    if (active && payload?.length && coordinate) {
      const closest = getClosestLineToCursor(payload, coordinate, chartHeight);
      setActiveLine(closest);
    } else {
      setActiveLine(null);
    }
  }, [active, payload, coordinate, setActiveLine, chartHeight]);

  if (!active || !payload?.length) return null;
  const closest = getClosestLineToCursor(payload, coordinate, chartHeight);
  const p = payload.find((item) => item.dataKey === closest);
  if (!p || p.value == null) return null;
  return (
    <div className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-gray-200">
      <div className="mb-1 text-gray-400">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <span style={{ color: p.color }}>{p.dataKey}</span>
        <span>{formatCurrency(Number(p.value) * 100)}</span>
      </div>
    </div>
  );
}

interface ChartsSectionProps {
  players: Player[];
  games: Game[];
}

export function ChartsSection({ players, games }: ChartsSectionProps) {
  const [activeLineCumulative, setActiveLineCumulative] = useState<string | null>(null);
  const [activeLineAverage, setActiveLineAverage] = useState<string | null>(null);
  const [barRange, setBarRange] = useState<'week' | 'month' | 'quarter'>('quarter');
  const getGameDate = (dateStr: string) => new Date(`${dateStr.slice(0, 10)}T00:00:00`);

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
      for (const player of players) {
        const result = game.results[player.id];
        if (result !== undefined) {
          cumulative[player.id] = (cumulative[player.id] || 0) + result;
          counts[player.id] = (counts[player.id] || 0) + 1;
        }
        const avg = counts[player.id] ? cumulative[player.id] / counts[player.id] : 0;
        entry[player.name] = avg / 100;
      }
      data.push(entry);
    }

    return data;
  }, [players, games]);

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
      return { player: player.name, total: total / 100 };
    });
  }, [players, games, barRange]);

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-4">📈 Profit/Loss Over Time</h2>
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={440}>
          <LineChart data={cumulativeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              content={(props) => (
                <ClosestLineTooltip
                  {...props}
                  setActiveLine={setActiveLineCumulative}
                  chartHeight={CHART_HEIGHT}
                />
              )}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {players.map((player, index) => {
              const color = `hsl(${(index * 360) / players.length}, 70%, 50%)`;
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
      </div>

      <div className="border-t border-gray-700 pt-5">
        <h3 className="text-lg font-semibold text-white mb-3">Average Profit/Loss Per Game</h3>
        <ResponsiveContainer width="100%" height={440}>
          <LineChart data={averageData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              content={(props) => (
                <ClosestLineTooltip
                  {...props}
                  setActiveLine={setActiveLineAverage}
                  chartHeight={CHART_HEIGHT}
                />
              )}
            />
            <Legend wrapperStyle={{ color: '#9ca3af' }} />
            {players.map((player, index) => {
              const color = `hsl(${(index * 360) / players.length}, 70%, 50%)`;
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
            <XAxis dataKey="player" stroke="#9ca3af" angle={-25} textAnchor="end" height={70} />
            <YAxis stroke="#9ca3af" tickFormatter={(value) => `$${value}`} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: number) => formatCurrency(value * 100)}
            />
            <Bar dataKey="total" fill="#60a5fa">
              {playerTotalsData.map((entry, index) => (
                <Cell key={entry.player} fill={entry.total >= 0 ? '#34d399' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
