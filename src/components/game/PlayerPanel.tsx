import type { TrainCardColor } from '../../game/gameTypes';
import type { ClientPlayerView } from '../../../shared/protocol';
import { NORMAL_TRAIN_CARD_COLORS } from '../../game/trainCards';
import { formatCardColor, TrainCardView } from './TrainCardView';

interface PlayerPanelProps {
  players: ClientPlayerView[];
  currentPlayerId: string;
  viewerPlayerId?: string;
  statusMessage: string;
  waitingMessage?: string;
  faceUpTrainCards: TrainCardColor[];
  trainDeckCount: number;
  trainDiscardCount: number;
  destinationTicketDeckCount: number;
  cardsDrawnThisTurn: number;
  activeTicketSummaries: Array<{
    id: string;
    fromName: string;
    toName: string;
    points: number;
    status: 'connected' | 'station' | 'incomplete';
  }>;
  activeDestinationScore: number;
  activeProjectedTotal: number;
  canDrawTrainCards: boolean;
  canDrawDestinationTickets: boolean;
  canPlaceStation: boolean;
  canResetGame: boolean;
  gamePhase: string;
  finalTurnsRemaining: number;
  recentlyDrawnCard?: {
    color: TrainCardColor;
    eventId: string;
  };
  onDrawFaceUpCard: (index: number) => void;
  onDrawDeckCard: () => void;
  onDrawDestinationTickets: () => void;
  onBeginPlaceStation: () => void;
  onOpenScoreBreakdown: () => void;
  onResetGame: () => void;
}

export function PlayerPanel({
  players,
  currentPlayerId,
  viewerPlayerId,
  statusMessage,
  waitingMessage,
  faceUpTrainCards,
  trainDeckCount,
  trainDiscardCount,
  destinationTicketDeckCount,
  cardsDrawnThisTurn,
  activeTicketSummaries,
  activeDestinationScore,
  activeProjectedTotal,
  canDrawTrainCards,
  canDrawDestinationTickets,
  canPlaceStation,
  canResetGame,
  gamePhase,
  finalTurnsRemaining,
  recentlyDrawnCard,
  onDrawFaceUpCard,
  onDrawDeckCard,
  onDrawDestinationTickets,
  onBeginPlaceStation,
  onOpenScoreBreakdown,
  onResetGame,
}: PlayerPanelProps) {
  const turnPlayer = players.find((player) => player.id === currentPlayerId);
  const viewerPlayer = players.find((player) => player.id === viewerPlayerId);
  const viewerHand = viewerPlayer?.hand;
  const visibleHandCards = viewerHand
    ? ([...NORMAL_TRAIN_CARD_COLORS, 'locomotive' as const] satisfies TrainCardColor[]).filter(
        (color) => viewerHand[color] > 0,
      )
    : [];

  return (
    <aside className="player-panel" aria-label="Game status">
      <section className="sidebar-section turn-summary">
        <p className="app-kicker">Greece Rails</p>
        <p className="panel-label">Current turn</p>
        <strong>{turnPlayer?.name ?? 'Unknown player'}</strong>
        {waitingMessage && <p className="draw-progress">{waitingMessage}</p>}
        <p className="draw-progress">Cards drawn this turn: {cardsDrawnThisTurn}/2</p>
        <p className="draw-progress">
          Phase: {gamePhase}
          {gamePhase === 'finalRound' ? `, final turns left: ${finalTurnsRemaining}` : ''}
        </p>
      </section>

      <section className="sidebar-section">
        <p className="panel-label">Players</p>
        <div className="player-list">
          {players.map((player) => {
            const isActive = player.id === currentPlayerId;

            return (
              <section key={player.id} className="player-card" data-active={isActive}>
                <span className="player-swatch" style={{ backgroundColor: player.color }} />
                <div>
                  <h2>{player.name}</h2>
                  <p>Score: {player.score}</p>
                  <p>Trains: {player.trainsRemaining}</p>
                  <p>Cards: {player.cardCount}</p>
                  <p>Destination tickets: {player.destinationTicketCount}</p>
                  <p>Stations: {player.stationsRemaining}</p>
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {viewerHand && (
        <section className="sidebar-section hand-panel">
          <p className="panel-label">Your hand</p>
          <div className="hand-card-list">
            {visibleHandCards.map((color) => (
              <div
                key={`${color}-${recentlyDrawnCard?.color === color ? recentlyDrawnCard.eventId : 'stable'}`}
                className="hand-card-row"
                data-recently-drawn={recentlyDrawnCard?.color === color}
              >
                <TrainCardView
                  card={color}
                  label={`${formatCardColor(color)} train card`}
                  count={viewerHand[color]}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {viewerPlayer && (
        <section className="sidebar-section destination-ticket-list">
          <div className="market-header">
            <p className="panel-label">Destinations</p>
            <p>Deck: {destinationTicketDeckCount}</p>
          </div>

          <div className="owned-ticket-list">
            {activeTicketSummaries.length > 0 ? (
              activeTicketSummaries.map((ticket) => (
                <article key={ticket.id} className="owned-ticket" data-status={ticket.status}>
                  <strong>
                    {ticket.fromName} to {ticket.toName}
                  </strong>
                  <span>
                    {ticket.points} points |{' '}
                    {ticket.status === 'connected'
                      ? 'Connected'
                      : ticket.status === 'station'
                        ? 'Connected using station'
                        : 'Incomplete'}
                  </span>
                </article>
              ))
            ) : (
              <p className="empty-note">No destination tickets.</p>
            )}
          </div>

          <button
            type="button"
            className="secondary-button"
            disabled={!canDrawDestinationTickets}
            onClick={onDrawDestinationTickets}
          >
            Draw Destination Tickets
          </button>
        </section>
      )}

      {viewerPlayer && (
        <section className="sidebar-section station-action-section">
          <p className="panel-label">Stations</p>
          <p className="draw-progress">Stations remaining: {viewerPlayer.stationsRemaining}</p>
          <button
            type="button"
            className="secondary-button"
            disabled={!canPlaceStation}
            onClick={onBeginPlaceStation}
          >
            Place Station
          </button>
        </section>
      )}

      <section className="sidebar-section train-market">
        <div className="market-header">
          <p className="panel-label">Face-up cards</p>
          <p>Discard: {trainDiscardCount}</p>
        </div>

        <div className="face-up-cards">
          {faceUpTrainCards.map((card, index) => (
            <button
              key={`${card}-${index}`}
              type="button"
              className="face-up-card"
              disabled={!canDrawTrainCards}
              onClick={() => onDrawFaceUpCard(index)}
            >
              <TrainCardView
                card={card}
                label={`${formatCardColor(card)} train card`}
                interactive
              />
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-section draw-pile-section">
        <p className="panel-label">Hidden draw pile</p>
        <button type="button" className="draw-pile" disabled={!canDrawTrainCards} onClick={onDrawDeckCard}>
          <TrainCardView card="back" label="Hidden train card deck" interactive />
          <span>
            <strong>Draw deck</strong>
            <small>{trainDeckCount} cards remaining</small>
          </span>
        </button>
      </section>

      <section className="sidebar-section panel-actions">
        <button type="button" className="secondary-button" disabled={!canResetGame} onClick={onResetGame}>
          Reset Game
        </button>
      </section>

      <section className="sidebar-section status-section">
        <p className="panel-label">Status</p>
        <p className="status-message">{statusMessage || 'Awaiting player action.'}</p>
      </section>

      {viewerPlayer && (
        <section className="sidebar-section score-preview">
          <p className="panel-label">Final score preview</p>
          <p>Route score: {viewerPlayer.score}</p>
          <p>Destination score: {activeDestinationScore >= 0 ? '+' : ''}{activeDestinationScore}</p>
          <strong>Projected total: {activeProjectedTotal}</strong>
          <button type="button" className="secondary-button" onClick={onOpenScoreBreakdown}>
            Score breakdown
          </button>
        </section>
      )}
    </aside>
  );
}
