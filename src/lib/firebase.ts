import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDds2h_5sWjr6mHD8NKVdVBptCu8EADxlk',
  authDomain: 'dairy-farm-poker-ledger.firebaseapp.com',
  projectId: 'dairy-farm-poker-ledger',
  storageBucket: 'dairy-farm-poker-ledger.firebasestorage.app',
  messagingSenderId: '708095680591',
  appId: '1:708095680591:web:4905c5ad2ca2ed3679ca3a',
  measurementId: 'G-F0FSB5HWZ5',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
