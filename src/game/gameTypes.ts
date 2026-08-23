export interface Player {
  id: string;
  name: string;
  color: string;
  trainsRemaining: number;
  hand: TrainCardHand;
  score: number;
  destinationTickets: DestinationTicket[];
  stationsRemaining: number;
}

export type RouteOwnership = Record<string, string>;
export type StationOwnership = Record<string, string>;

export type TrainCardColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'black'
  | 'white'
  | 'orange'
  | 'pink'
  | 'locomotive';

export type NormalTrainCardColor = Exclude<TrainCardColor, 'locomotive'>;

export type TrainCardHand = Record<TrainCardColor, number>;

export type TurnAction =
  | 'none'
  | 'drawTrainCards'
  | 'claimRoute'
  | 'drawDestinationTickets'
  | 'placeStation';

export type TrainDrawSource = 'deck' | 'faceUp';

export type GamePhase = 'initialTickets' | 'playing' | 'finalRound' | 'finished';

export interface DestinationTicket {
  id: string;
  from: string;
  to: string;
  points: number;
}

export interface PaymentOption {
  paymentColor: NormalTrainCardColor | 'locomotive';
  normalCards: number;
  locomotives: number;
}

export interface PendingClaim {
  routeId: string;
  paymentOptions: PaymentOption[];
}

export interface PendingTunnelAttempt {
  routeId: string;
  playerId: string;
  basePayment: PaymentOption;
  revealedCards: TrainCardColor[];
  extraCost: number;
  extraPaymentOptions: PaymentOption[];
}

export interface PendingStationPlacement {
  cityId?: string;
  paymentOptions: PaymentOption[];
}

export interface PendingDestinationTicketSelection {
  mode: 'setup' | 'turn';
  playerId: string;
  tickets: DestinationTicket[];
  minKeep: number;
}

export interface GameState {
  players: Player[];
  currentPlayerId: string;
  gamePhase: GamePhase;
  routeOwnership: RouteOwnership;
  stationOwnership: StationOwnership;
  trainDeck: TrainCardColor[];
  trainDiscardPile: TrainCardColor[];
  faceUpTrainCards: TrainCardColor[];
  cardsDrawnThisTurn: number;
  trainDrawSourcesThisTurn: TrainDrawSource[];
  deckOnlyDrawStreakByPlayer: Record<string, number>;
  deckOnlyDrawRefreshCount: number;
  turnAction: TurnAction;
  pendingClaim?: PendingClaim;
  pendingTunnelAttempt?: PendingTunnelAttempt;
  pendingStationPlacement?: PendingStationPlacement;
  destinationTicketDeck: DestinationTicket[];
  pendingDestinationTicketSelection?: PendingDestinationTicketSelection;
  setupPlayerIndex: number;
  finalRoundTriggerPlayerId?: string;
  finalTurnsRemaining: number;
  statusMessage: string;
}
