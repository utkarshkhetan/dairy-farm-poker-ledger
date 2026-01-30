import { useMemo } from 'react';
import { usePlayers, useGames, useStats } from '../hooks';
import { LifetimeStandings } from './LifetimeStandings';
import { FunStats } from './FunStats';
import { TrendingSection } from './TrendingSection';
import { ChartsSection } from './ChartsSection';
import { GameLog } from './GameLog';
import { AdminUpload } from './AdminUpload';

export function Dashboard() {
  const { players, loading: playersLoading, error: playersError } = usePlayers();
  const { games, loading: gamesLoading, error: gamesError } = useGames();
  const { lifetimeStandings, funStats } = useStats(players, games);

  const loading = playersLoading || gamesLoading;
  const error = playersError || gamesError;

  // Must be called unconditionally (Rules of Hooks) - before any early returns
  const cows = useMemo(
    () =>
      Array.from({ length: 180 }, (_, i) => ({
        id: i,
        x: (i * 37) % 100,
        y: (i * 73) % 100,
        size: 14 + (i % 8) * 3,
        duration: 3 + (i % 5) * 0.8,
        delay: -(i % 12),
        rotate: (i * 29) % 360,
        opacity: 0.3 + (i % 6) * 0.05,
      })),
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-2xl px-4">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🐄 Dairy Farm Poker Ledger
          </h1>
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6 mb-4">
            <p className="text-red-400 font-semibold mb-2">Firestore Error</p>
            <p className="text-gray-300 text-sm">{error}</p>
          </div>
          <div className="text-left bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-white font-semibold mb-2">Troubleshooting:</p>
            <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
              <li>Check Firebase Console → Firestore Database → Data tab to verify data exists</li>
              <li>Go to Firebase Console → Firestore Database → Rules tab</li>
              <li>Ensure rules allow reads: <code className="bg-gray-900 px-2 py-1 rounded">allow read: if true;</code></li>
              <li>Click "Publish" to deploy rules</li>
              <li>If no data, run: <code className="bg-gray-900 px-2 py-1 rounded">cd scripts && npm run seed</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (games.length === 0 || players.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-2xl px-4">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🐄 Dairy Farm Poker Ledger
          </h1>
          <p className="text-gray-400 text-lg mb-4">
            No data found in Firestore.
          </p>
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-left">
            <p className="text-white font-semibold mb-2">To import data:</p>
            <ol className="text-gray-400 text-sm space-y-2 list-decimal list-inside">
              <li>Make sure the Admin SDK key file is in the project root</li>
              <li>Run: <code className="bg-gray-900 px-2 py-1 rounded">cd scripts && npm install && npm run seed</code></li>
              <li>Check Firebase Console → Firestore → Data to verify data was created</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white relative overflow-hidden">
      <div className="cow-field pointer-events-none absolute inset-0">
        {cows.map((cow) => (
          <span
            key={cow.id}
            style={{
              left: `${cow.x}%`,
              top: `${cow.y}%`,
              fontSize: `${cow.size}px`,
              animationDuration: `${cow.duration}s`,
              animationDelay: `${cow.delay}s`,
              transform: `translate(-50%, -50%) rotate(${cow.rotate}deg)`,
              opacity: cow.opacity,
            }}
          >
            🐄
          </span>
        ))}
      </div>
      <div className="container mx-auto px-4 py-6 max-w-7xl relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            🐄 Dairy Farm Poker Ledger
          </h1>
          <p className="text-gray-400 text-sm md:text-base">Sleek stats, lifetime standings, and trend insights</p>
        </div>

        {/* Lifetime Standings (Full List First) */}
        <div className="mb-6">
          <LifetimeStandings standings={lifetimeStandings} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          <div className="lg:col-span-7">
            <ChartsSection players={players} games={games} />
          </div>
          <div className="lg:col-span-5">
            <FunStats stats={funStats} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
          <div className="lg:col-span-6">
            <TrendingSection players={players} games={games} />
          </div>
          <div className="lg:col-span-6">
            <GameLog games={games} players={players} />
          </div>
        </div>
      </div>

      {/* Admin Upload */}
      <AdminUpload onUploadComplete={() => {}} />
    </div>
  );
}
