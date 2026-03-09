import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { PlayerProfile } from './components/PlayerProfile';
import { recordVisit } from './lib/visitTracking';
import './index.css';

function VisitTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    recordVisit();
  }, [pathname]);
  return null;
}

function App() {
  const base = import.meta.env.BASE_URL;
  const basename =
    typeof window !== 'undefined' && window.location.pathname.startsWith(base)
      ? base
      : '/';
  return (
    <BrowserRouter basename={basename}>
      <VisitTracker />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/player/:playerId" element={<PlayerProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
