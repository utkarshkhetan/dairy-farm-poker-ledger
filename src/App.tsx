import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { PlayerProfile } from './components/PlayerProfile';
import './index.css';

function App() {
  const base = import.meta.env.BASE_URL;
  const basename =
    typeof window !== 'undefined' && window.location.pathname.startsWith(base)
      ? base
      : '/';
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/player/:playerId" element={<PlayerProfile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
