import type { GameConfigView, LobbyPlayerView } from '../../../shared/protocol';

interface LobbyProps {
  players: LobbyPlayerView[];
  isHost: boolean;
  gameConfig: GameConfigView;
  message?: string;
  onSetStartingTrains: (value: number) => void;
  onStart: () => void;
}

export function Lobby({
  players,
  isHost,
  gameConfig,
  message,
  onSetStartingTrains,
  onStart,
}: LobbyProps) {
  const clampStartingTrains = (value: number) =>
    Math.min(gameConfig.maxStartingTrains, Math.max(gameConfig.minStartingTrains, value));

  return (
    <main className="join-screen">
      <section className="join-panel">
        <p className="app-kicker">Lobby</p>
        <h1>Ticket to Ride Greece</h1>
        <div className="player-list">
          {players.map((player) => (
            <section key={player.id} className="player-card" data-active={player.isHost}>
              <span className="player-swatch" style={{ backgroundColor: player.color }} />
              <div>
                <h2>{player.name}</h2>
                <p>{player.isHost ? 'Host' : 'Player'}</p>
              </div>
            </section>
          ))}
        </div>
        <section className="lobby-config">
          <div>
            <p className="panel-label">Starting trains per player</p>
            <p>
              Allowed: {gameConfig.minStartingTrains}-{gameConfig.maxStartingTrains}
            </p>
            <p>Standard game: {gameConfig.standardStartingTrains}</p>
          </div>
          {isHost ? (
            <div className="lobby-train-control">
              <button
                type="button"
                aria-label="Decrease starting trains"
                disabled={gameConfig.startingTrains <= gameConfig.minStartingTrains}
                onClick={() => onSetStartingTrains(clampStartingTrains(gameConfig.startingTrains - 1))}
              >
                -
              </button>
              <input
                type="number"
                min={gameConfig.minStartingTrains}
                max={gameConfig.maxStartingTrains}
                step={1}
                value={gameConfig.startingTrains}
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);

                  if (Number.isInteger(value)) {
                    onSetStartingTrains(clampStartingTrains(value));
                  }
                }}
              />
              <button
                type="button"
                aria-label="Increase starting trains"
                disabled={gameConfig.startingTrains >= gameConfig.maxStartingTrains}
                onClick={() => onSetStartingTrains(clampStartingTrains(gameConfig.startingTrains + 1))}
              >
                +
              </button>
            </div>
          ) : (
            <strong className="lobby-train-readout">{gameConfig.startingTrains}</strong>
          )}
        </section>
        {isHost ? (
          <button type="button" disabled={players.length < 2} onClick={onStart}>
            Start Game
          </button>
        ) : (
          <p>Waiting for the host to start the game.</p>
        )}
        {message && <p className="status-message">{message}</p>}
      </section>
    </main>
  );
}
