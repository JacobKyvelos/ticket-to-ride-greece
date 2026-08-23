import type { CSSProperties } from 'react';
import type { TrainCardColor } from '../../game/gameTypes';
import type { ClientPlayerView } from '../../../shared/protocol';
import { NORMAL_TRAIN_CARD_COLORS } from '../../game/trainCards';
import { formatCardColor, TrainCardView } from './TrainCardView';

interface BottomCardBarProps {
  viewerPlayer?: ClientPlayerView;
  faceUpTrainCards: TrainCardColor[];
  trainDeckCount: number;
  destinationTicketDeckCount: number;
  cardsDrawnThisTurn: number;
  canDrawTrainCards: boolean;
  canDrawDestinationTickets: boolean;
  recentlyDrawnCard?: {
    color: TrainCardColor;
    eventId: string;
  };
  onDrawFaceUpCard: (index: number) => void;
  onDrawDeckCard: () => void;
  onDrawDestinationTickets: () => void;
}

export function BottomCardBar({
  viewerPlayer,
  faceUpTrainCards,
  trainDeckCount,
  destinationTicketDeckCount,
  cardsDrawnThisTurn,
  canDrawTrainCards,
  canDrawDestinationTickets,
  recentlyDrawnCard,
  onDrawFaceUpCard,
  onDrawDeckCard,
  onDrawDestinationTickets,
}: BottomCardBarProps) {
  const viewerHand = viewerPlayer?.hand;
  const visibleHandCards = viewerHand
    ? ([...NORMAL_TRAIN_CARD_COLORS, 'locomotive' as const] satisfies TrainCardColor[]).filter(
        (color) => viewerHand[color] > 0,
      )
    : [];

  return (
    <section className="bottom-card-bar" aria-label="Train card controls">
      <div className="bottom-card-bar__section public-card-area">
        <div className="bottom-card-bar__header">
          <p className="panel-label">Draw</p>
          <span>Public cards and decks</span>
        </div>
        <div className="public-card-row" aria-label="Available draw cards">
          {Array.from({ length: 5 }).map((_, index) => {
            const card = faceUpTrainCards[index];
            const locomotiveSecondDrawBlocked = cardsDrawnThisTurn > 0 && card === 'locomotive';
            const disabled = !card || !canDrawTrainCards || locomotiveSecondDrawBlocked;
            const title = locomotiveSecondDrawBlocked
              ? 'A face-up locomotive can only be taken as the first draw.'
              : disabled
                ? 'You cannot draw this card right now.'
                : `Draw ${formatCardColor(card)} train card`;

            return (
              <button
                key={`face-up-${index}`}
                type="button"
                className="bottom-card-slot bottom-card-slot--train"
                disabled={disabled}
                title={title}
                onClick={() => onDrawFaceUpCard(index)}
              >
                {card && (
                  <TrainCardView
                    card={card}
                    label={`${formatCardColor(card)} train card`}
                    interactive={!disabled}
                  />
                )}
                <span className="bottom-card-slot__count" aria-hidden="true">
                  &nbsp;
                </span>
              </button>
            );
          })}

          <button
            type="button"
            className="bottom-card-slot bottom-card-slot--deck"
            disabled={!canDrawTrainCards}
            title={canDrawTrainCards ? 'Draw from the hidden train deck' : 'You cannot draw now.'}
            onClick={onDrawDeckCard}
          >
            <TrainCardView card="back" label="Hidden train card deck" interactive={canDrawTrainCards} />
            <span className="bottom-card-slot__count">{trainDeckCount}</span>
          </button>

          <button
            type="button"
            className="bottom-card-slot bottom-card-slot--destination"
            disabled={!canDrawDestinationTickets}
            title={
              canDrawDestinationTickets
                ? 'Draw destination tickets'
                : 'Destination tickets cannot be drawn right now.'
            }
            onClick={onDrawDestinationTickets}
          >
            <TrainCardView
              card="ticket"
              label="Destination ticket deck"
              interactive={canDrawDestinationTickets}
            />
            <span className="bottom-card-slot__count">{destinationTicketDeckCount}</span>
          </button>
        </div>
      </div>

      <div className="bottom-card-bar__section player-hand-area">
        <div className="bottom-card-bar__header">
          <p className="panel-label">My hand</p>
          <span>{viewerPlayer ? `${viewerPlayer.cardCount} train cards` : 'Private cards'}</span>
        </div>
        <div
          className="bottom-hand-row"
          style={
            {
              '--hand-card-count': Math.max(visibleHandCards.length, 1),
            } as CSSProperties
          }
        >
          {visibleHandCards.length > 0 ? (
            visibleHandCards.map((color) => (
              <div
                key={`${color}-${recentlyDrawnCard?.color === color ? recentlyDrawnCard.eventId : 'stable'}`}
                className="bottom-hand-card"
                data-recently-drawn={recentlyDrawnCard?.color === color}
              >
                <TrainCardView
                  card={color}
                  label={`${formatCardColor(color)} train card`}
                  interactive={false}
                />
                <strong className="bottom-hand-card__count">x {viewerHand?.[color] ?? 0}</strong>
              </div>
            ))
          ) : (
            <p className="empty-note">No train cards in hand.</p>
          )}
        </div>
      </div>
    </section>
  );
}
