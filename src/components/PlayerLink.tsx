import { Link } from 'react-router-dom';

interface PlayerLinkProps {
  playerId: string;
  children: React.ReactNode;
  className?: string;
}

export function PlayerLink({ playerId, children, className = '' }: PlayerLinkProps) {
  return (
    <Link
      to={`/player/${playerId}`}
      className={`text-white font-medium hover:underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded ${className}`}
    >
      {children}
    </Link>
  );
}
