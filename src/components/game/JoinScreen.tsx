import { useState } from 'react';

interface JoinScreenProps {
  connectionStatus: string;
  message?: string;
  onJoin: (name: string) => void;
}

export function JoinScreen({ connectionStatus, message, onJoin }: JoinScreenProps) {
  const [name, setName] = useState('');

  return (
    <main className="join-screen">
      <section className="join-panel">
        <p className="app-kicker">LAN multiplayer</p>
        <h1>Ticket to Ride Greece</h1>
        <p>Connection: {connectionStatus}</p>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="button" onClick={() => onJoin(name)}>
          Join Game
        </button>
        {message && <p className="status-message">{message}</p>}
      </section>
    </main>
  );
}
