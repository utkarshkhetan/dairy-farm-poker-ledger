import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Player } from '../types';

export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    try {
      setLoading(true);
      const playersRef = collection(db, 'players');
      const snapshot = await getDocs(playersRef);
      const playersData: Player[] = [];
      
      snapshot.forEach((doc) => {
        playersData.push({ id: doc.id, ...doc.data() } as Player);
      });
      
      setPlayers(playersData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }

  async function createPlayer(player: Omit<Player, 'id'>): Promise<string> {
    const playersRef = collection(db, 'players');
    const newPlayerRef = doc(playersRef);
    await setDoc(newPlayerRef, player);
    await loadPlayers();
    return newPlayerRef.id;
  }

  async function updatePlayer(playerId: string, updates: Partial<Player>) {
    const playerRef = doc(db, 'players', playerId);
    await setDoc(playerRef, updates, { merge: true });
    await loadPlayers();
  }

  async function findPlayerByPlayerId(playerId: string): Promise<Player | null> {
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    
    for (const docSnap of snapshot.docs) {
      const player = { id: docSnap.id, ...docSnap.data() } as Player;
      if (player.playerIds.includes(playerId)) {
        return player;
      }
    }
    
    return null;
  }

  async function findPlayerByNickname(nickname: string): Promise<Player | null> {
    const normalizedNickname = nickname.toLowerCase().trim();
    const playersRef = collection(db, 'players');
    const snapshot = await getDocs(playersRef);
    
    for (const docSnap of snapshot.docs) {
      const player = { id: docSnap.id, ...docSnap.data() } as Player;
      const normalizedNicknames = player.nicknames.map(n => n.toLowerCase().trim());
      if (normalizedNicknames.includes(normalizedNickname)) {
        return player;
      }
    }
    
    return null;
  }

  return {
    players,
    loading,
    error,
    createPlayer,
    updatePlayer,
    findPlayerByPlayerId,
    findPlayerByNickname,
    refresh: loadPlayers,
  };
}
