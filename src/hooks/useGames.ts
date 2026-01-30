import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Game } from '../types';

export function useGames() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    try {
      setLoading(true);
      const gamesRef = collection(db, 'games');
      const snapshot = await getDocs(gamesRef);
      const gamesData: Game[] = [];
      
      snapshot.forEach((doc) => {
        gamesData.push({ id: doc.id, ...doc.data() } as Game);
      });
      
      // Sort by date descending (newest first)
      gamesData.sort((a, b) => b.date.localeCompare(a.date));
      
      setGames(gamesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }

  async function createGame(game: Omit<Game, 'id'>): Promise<string> {
    const gamesRef = collection(db, 'games');
    const newGameRef = doc(gamesRef);
    await setDoc(newGameRef, game);
    await loadGames();
    return newGameRef.id;
  }

  async function gameExists(date: string): Promise<boolean> {
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, where('date', '==', date));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  async function getGameByDate(date: string): Promise<Game | null> {
    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, where('date', '==', date));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Game;
  }

  return {
    games,
    loading,
    error,
    createGame,
    gameExists,
    getGameByDate,
    refresh: loadGames,
  };
}
