import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Visit {
  id: string;
  path: string;
  referrer: string;
  userAgent: string;
  sessionId: string;
  timestamp: { seconds: number; nanoseconds: number } | null;
}

export function useVisits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVisits = useCallback(async () => {
    try {
      setLoading(true);
      const ref = collection(db, 'visits');
      const q = query(ref, orderBy('timestamp', 'desc'), limit(200));
      const snapshot = await getDocs(q);
      const data: Visit[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        data.push({
          id: docSnap.id,
          path: d.path ?? '',
          referrer: d.referrer ?? '',
          userAgent: d.userAgent ?? '',
          sessionId: d.sessionId ?? '',
          timestamp: d.timestamp ?? null,
        });
      });
      setVisits(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  return { visits, loading, error, refresh: loadVisits };
}
