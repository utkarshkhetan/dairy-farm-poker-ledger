import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

const SESSION_KEY = 'dfpl_session_id';

function getOrCreateSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `s-${Date.now()}`;
  }
}

export interface VisitPayload {
  path: string;
  referrer: string;
  userAgent: string;
  sessionId: string;
}

export function getVisitPayload(): VisitPayload {
  return {
    path: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
    referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    sessionId: getOrCreateSessionId(),
  };
}

export async function recordVisit(): Promise<void> {
  try {
    const payload = getVisitPayload();
    const ref = collection(db, 'visits');
    await addDoc(ref, {
      ...payload,
      timestamp: serverTimestamp(),
    });
  } catch (_) {
    // Fail silently so tracking never breaks the app
  }
}
