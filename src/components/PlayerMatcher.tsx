import { useState, useEffect } from 'react';
import { Player, UploadRow } from '../types';

interface PlayerMatcherProps {
  unmatchedRows: Array<{ row: UploadRow; index: number }>;
  players: Player[];
  onMatch: (rowIndex: number, playerId: string | null, playerName: string, savePlayerId: boolean) => Promise<void>;
  onCreateNew: (rowIndex: number, playerName: string, playerId: string, savePlayerId: boolean) => Promise<void>;
}

export function PlayerMatcher({
  unmatchedRows,
  players,
  onMatch,
  onCreateNew,
}: PlayerMatcherProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [savePlayerId, setSavePlayerId] = useState(true);
  const [matching, setMatching] = useState(false);

  // Reset index when unmatched rows change
  useEffect(() => {
    if (unmatchedRows.length > 0 && currentIndex >= unmatchedRows.length) {
      setCurrentIndex(0);
    }
  }, [unmatchedRows.length, currentIndex]);

  if (unmatchedRows.length === 0) {
    return null;
  }

  const currentRow = unmatchedRows[currentIndex];
  if (!currentRow) {
    return null;
  }

  const currentRowData = currentRow.row;

  const handleMatch = async (playerId: string) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    setMatching(true);
    try {
      await onMatch(currentRow.index, playerId, player.name, savePlayerId);
      // Index will be updated by parent component removing the row
      // If there are more rows, stay on current index (which will be the next row)
      // If this was the last row, component will unmount
    } finally {
      setMatching(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newPlayerName.trim()) return;
    
    setMatching(true);
    try {
      await onCreateNew(currentRow.index, newPlayerName.trim(), currentRowData.player_id, savePlayerId);
      setNewPlayerName('');
      // Index will be updated by parent component removing the row
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl p-8 border border-gray-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-4">Match Player</h2>
        <p className="text-gray-400 mb-6">
          Row {currentIndex + 1} of {unmatchedRows.length}
        </p>

        <div className="bg-gray-900 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">Player Nickname:</p>
          <p className="text-lg font-semibold text-white">{currentRowData.player_nickname}</p>
          <p className="text-sm text-gray-400 mt-2 mb-2">Player ID:</p>
          <p className="text-sm text-gray-300 font-mono">{currentRowData.player_id}</p>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-2 text-gray-300 mb-4">
            <input
              type="checkbox"
              checked={savePlayerId}
              onChange={(e) => setSavePlayerId(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Save this player_id for future automatic matching</span>
          </label>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Match to existing player:</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {players.map((player) => (
              <button
                key={player.id}
                onClick={() => handleMatch(player.id)}
                disabled={matching}
                className="w-full text-left p-3 bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="text-white font-medium">{player.name}</div>
                {player.playerIds.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Known IDs: {player.playerIds.join(', ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-white mb-3">Or create new player:</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Enter first name"
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateNew()}
            />
            <button
              onClick={handleCreateNew}
              disabled={matching || !newPlayerName.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
