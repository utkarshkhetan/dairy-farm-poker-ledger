import { useState } from 'react';
import { useGames, usePlayers, useVisits } from '../hooks';
import { parseUploadCSV, getGameDateFromRows, formatDisplayDate, parseLedgerNet } from '../lib/csvParser';
import { PlayerMatcher } from './PlayerMatcher';
import { UploadRow } from '../types';

type AdminView = 'menu' | 'upload' | 'analytics';

const SECRET_CODE = 'milkdaddy';
const KNOWN_PLAYER_IDS: Record<string, string> = {
  'Gx6CTDK1-V': 'Garrett',
  'yA8s_xTBKa': 'Sampath',
  '3eq6PWL0fX': 'Abhi',
  'LxxSO_Q8Xm': 'Shik',
  'dLUVSEvjqU': 'Ano',
};

interface AdminUploadProps {
  onUploadComplete: () => void;
}

export function AdminUpload({ onUploadComplete }: AdminUploadProps) {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [adminView, setAdminView] = useState<AdminView>('menu');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [unmatchedRows, setUnmatchedRows] = useState<Array<{ row: UploadRow; index: number }>>([]);
  const [matchedData, setMatchedData] = useState<Record<number, { playerId: string; playerName: string; net: number }>>({});
  const [allRows, setAllRows] = useState<UploadRow[]>([]);
  const [gameDate, setGameDate] = useState<string>('');
  const [uploadPokerNowCode, setUploadPokerNowCode] = useState<string | null>(null);

  const { createGame, gameExists, refresh: refreshGames } = useGames();
  const {
    players,
    createPlayer,
    updatePlayer,
    findPlayerByPlayerId,
    findPlayerByNickname,
    refresh: refreshPlayers,
  } = usePlayers();
  const { visits, loading: visitsLoading, error: visitsError, refresh: refreshVisits } = useVisits();

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.toLowerCase() === SECRET_CODE.toLowerCase()) {
      setUnlocked(true);
      setAdminView('menu');
      setError(null);
    } else {
      setError('Incorrect code');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    const match = file.name.match(/^ledger_(.+)\.csv$/i);
    const pokerNowCodeFromFile = match ? match[1] : null;
    setUploadPokerNowCode(pokerNowCodeFromFile);

    try {
      const rows = await parseUploadCSV(file);
      
      if (rows.length === 0) {
        setError('CSV file is empty');
        setUploading(false);
        return;
      }

      // Use game START time (session_start_at) only, never session_end_at
      const gameDate = getGameDateFromRows(rows);
      const displayDate = formatDisplayDate(gameDate);

      // Check if game already exists
      const exists = await gameExists(gameDate);
      if (exists) {
        setError('A game for this date has already been uploaded');
        setUploading(false);
        return;
      }

      // Match players
      const matched: Record<number, { playerId: string; playerName: string; net: number }> = {};
      const unmatched: Array<{ row: UploadRow; index: number }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let matchedPlayer = null;

        // Try to match by player_id (known IDs first, then database)
        if (KNOWN_PLAYER_IDS[row.player_id]) {
          const playerName = KNOWN_PLAYER_IDS[row.player_id];
          matchedPlayer = players.find(p => p.name === playerName);
        } else {
          matchedPlayer = await findPlayerByPlayerId(row.player_id);
        }

        // If not found by player_id, try nickname
        if (!matchedPlayer) {
          matchedPlayer = await findPlayerByNickname(row.player_nickname);
        }

        if (matchedPlayer) {
          matched[i] = {
            playerId: matchedPlayer.id,
            playerName: matchedPlayer.name,
            net: parseLedgerNet(row.net),
          };
        } else {
          unmatched.push({ row, index: i });
        }
      }

      // Store all rows and date for later use
      setAllRows(rows);
      setGameDate(gameDate);

      if (unmatched.length > 0) {
        setUnmatchedRows(unmatched);
        setMatchedData(matched);
        // Wait for user to match players
        return;
      }

      // All matched, proceed with upload
      await processUpload(rows, matched, gameDate, displayDate, pokerNowCodeFromFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CSV');
    } finally {
      setUploading(false);
    }
  };

  const processUpload = async (
    _rows: UploadRow[],
    matched: Record<number, { playerId: string; playerName: string; net: number }>,
    gameDate: string,
    displayDate: string,
    pokerNowCode: string | null
  ) => {
    // Aggregate net values by player (handle re-buys)
    const aggregated: Record<string, number> = {};
    
    for (const match of Object.values(matched)) {
      if (aggregated[match.playerId]) {
        aggregated[match.playerId] += match.net;
      } else {
        aggregated[match.playerId] = match.net;
      }
    }

    // Create game
    await createGame({
      date: gameDate,
      displayDate,
      results: aggregated,
      ...(pokerNowCode ? { pokerNowCode } : {}),
    });

    setSuccess(true);
    await refreshGames();
    await refreshPlayers();
    onUploadComplete();

    // Reset after 3 seconds
    setTimeout(() => {
      setSuccess(false);
      setUnlocked(false);
      setAdminView('menu');
      setCode('');
      setShowCodeInput(false);
    }, 3000);
  };

  const handlePlayerMatch = async (
    rowIndex: number,
    playerId: string | null,
    playerName: string,
    savePlayerId: boolean
  ) => {
    if (!playerId) return;

    const row = unmatchedRows.find(ur => ur.index === rowIndex)?.row;
    if (!row) return;

    // Update matched data
    const net = parseLedgerNet(row.net);
    const updatedMatched = {
      ...matchedData,
      [rowIndex]: { playerId, playerName, net },
    };

    // Save player_id if requested
    if (savePlayerId) {
      const player = players.find(p => p.id === playerId);
      if (player && !player.playerIds.includes(row.player_id)) {
        await updatePlayer(playerId, {
          playerIds: [...player.playerIds, row.player_id],
        });
      }
    }

    // Remove from unmatched
    const remainingUnmatched = unmatchedRows.filter(ur => ur.index !== rowIndex);
    setUnmatchedRows(remainingUnmatched);
    setMatchedData(updatedMatched);

    // If all matched, process upload
    if (remainingUnmatched.length === 0) {
      const displayDate = formatDisplayDate(gameDate);
      await processUpload(allRows, updatedMatched, gameDate, displayDate, uploadPokerNowCode);
    }
  };

  const handleCreateNewPlayer = async (
    rowIndex: number,
    playerName: string,
    playerId: string,
    savePlayerId: boolean
  ) => {
    const row = unmatchedRows.find(ur => ur.index === rowIndex)?.row;
    if (!row) return;

    const newPlayerId = await createPlayer({
      name: playerName,
      playerIds: savePlayerId ? [playerId] : [],
      nicknames: [row.player_nickname],
    });

    // Refresh players list
    await refreshPlayers();

    await handlePlayerMatch(rowIndex, newPlayerId, playerName, false);
  };

  if (!showCodeInput && !unlocked) {
    return (
      <button
        onClick={() => setShowCodeInput(true)}
        className="px-5 py-2.5 text-sm font-medium text-gray-300 bg-gray-800/90 border border-gray-600 rounded-lg shadow-lg hover:bg-gray-700 hover:text-white hover:border-gray-500 transition-colors"
      >
        Admin (Ledger Upload)
      </button>
    );
  }

  if (showCodeInput && !unlocked) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-gray-800/90 rounded-xl p-8 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-4">Enter Admin Code</h2>
          <form onSubmit={handleCodeSubmit}>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false);
                  setCode('');
                  setError(null);
                }}
                className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (unmatchedRows.length > 0) {
    return (
      <>
        <PlayerMatcher
          unmatchedRows={unmatchedRows}
          players={players}
          onMatch={handlePlayerMatch}
          onCreateNew={handleCreateNewPlayer}
        />
      </>
    );
  }

  const closeAdmin = () => {
    setUnlocked(false);
    setCode('');
    setShowCodeInput(false);
    setAdminView('menu');
    setError(null);
  };

  if (unlocked && adminView === 'menu') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800/90 rounded-xl p-8 border border-gray-700 max-w-sm w-full">
          <h2 className="text-2xl font-bold text-white mb-6">Admin</h2>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setAdminView('upload')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Ledger upload
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminView('analytics');
                refreshVisits();
              }}
              className="w-full px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
            >
              Site analytics
            </button>
            <button
              type="button"
              onClick={closeAdmin}
              className="w-full px-6 py-2 text-gray-400 hover:text-white mt-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (unlocked && adminView === 'analytics') {
    const formatTime = (ts: { seconds: number; nanoseconds: number } | null) => {
      if (!ts) return '—';
      return new Date(ts.seconds * 1000).toLocaleString();
    };
    const truncate = (s: string, len: number) =>
      s.length <= len ? s : s.slice(0, len) + '…';
    const uniqueSessions = new Set(visits.map((v) => v.sessionId)).size;
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800/90 rounded-xl p-6 border border-gray-700 max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Site analytics</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={refreshVisits}
                className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setAdminView('menu')}
                className="px-4 py-2 text-sm bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Back
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div className="bg-gray-900/70 rounded-lg p-3 border border-gray-700">
              <span className="text-gray-400">Total page views</span>
              <p className="text-xl font-bold text-white">{visits.length}</p>
            </div>
            <div className="bg-gray-900/70 rounded-lg p-3 border border-gray-700">
              <span className="text-gray-400">Unique sessions (approx)</span>
              <p className="text-xl font-bold text-white">{uniqueSessions}</p>
            </div>
          </div>
          {visitsError && (
            <p className="text-red-400 text-sm mb-2">{visitsError}</p>
          )}
          <div className="overflow-auto flex-1 border border-gray-700 rounded-lg">
            {visitsLoading ? (
              <p className="text-gray-400 p-4">Loading…</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-900/80 sticky top-0">
                  <tr>
                    <th className="p-3 text-gray-400 font-medium">Time</th>
                    <th className="p-3 text-gray-400 font-medium">Path</th>
                    <th className="p-3 text-gray-400 font-medium">Referrer</th>
                    <th className="p-3 text-gray-400 font-medium">User agent</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {visits.map((v) => (
                    <tr key={v.id} className="border-t border-gray-700/70">
                      <td className="p-3 whitespace-nowrap">{formatTime(v.timestamp)}</td>
                      <td className="p-3">{v.path || '—'}</td>
                      <td className="p-3 max-w-[180px] truncate" title={v.referrer}>
                        {v.referrer ? truncate(v.referrer, 40) : '—'}
                      </td>
                      <td className="p-3 max-w-[220px] truncate" title={v.userAgent}>
                        {v.userAgent ? truncate(v.userAgent, 50) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (unlocked && adminView === 'upload') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800/90 rounded-xl p-8 border border-gray-700 max-w-md w-full">
          <h2 className="text-2xl font-bold text-white mb-4">Upload Game Data</h2>

          {success ? (
            <div className="text-center">
              <p className="text-green-400 text-lg mb-4">✓ Upload successful!</p>
              <p className="text-gray-400">Game data has been added to the ledger.</p>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="w-full mb-4 text-gray-300"
              />
              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              {uploading && <p className="text-gray-400">Processing...</p>}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setAdminView('menu')}
                  className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={closeAdmin}
                  className="px-6 py-2 text-gray-500 hover:text-white"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
