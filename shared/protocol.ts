import type {
  DestinationTicket,
  GamePhase,
  PaymentOption,
  PendingClaim,
  PendingDestinationTicketSelection,
  PendingStationPlacement,
  PendingTunnelAttempt,
  RouteOwnership,
  StationOwnership,
  TrainCardColor,
  TrainCardHand,
  TurnAction,
} from '../src/game/gameTypes.js';
import type {
  DestinationTicketResult,
  FinalScoreBreakdown,
  PlayerScoreBreakdown,
} from '../src/game/scoring.js';

export interface LobbyPlayerView {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

export interface GameConfigView {
  startingTrains: number;
  minStartingTrains: number;
  maxStartingTrains: number;
  standardStartingTrains: number;
}

export interface ClientPlayerView {
  id: string;
  name: string;
  color: string;
  trainsRemaining: number;
  score: number;
  stationsRemaining: number;
  cardCount: number;
  destinationTicketCount: number;
  hand?: TrainCardHand;
  destinationTickets?: DestinationTicket[];
  ticketResults?: DestinationTicketResult[];
  scoreBreakdown?: PlayerScoreBreakdown;
}

export interface ClientGameView {
  connectedPlayerId?: string;
  isHost: boolean;
  lobbyPlayers: LobbyPlayerView[];
  gameConfig: GameConfigView;
  gamePhase: GamePhase | 'lobby';
  currentPlayerId?: string;
  players: ClientPlayerView[];
  routeOwnership: RouteOwnership;
  stationOwnership: StationOwnership;
  faceUpTrainCards: TrainCardColor[];
  trainDeckCount: number;
  trainDiscardCount: number;
  destinationTicketDeckCount: number;
  cardsDrawnThisTurn: number;
  turnAction: TurnAction;
  pendingClaim?: PendingClaim;
  pendingTunnelAttempt?: PendingTunnelAttempt;
  pendingStationPlacement?: PendingStationPlacement;
  pendingDestinationTicketSelection?: PendingDestinationTicketSelection;
  finalRoundTriggerPlayerId?: string;
  finalTurnsRemaining: number;
  finalResults?: FinalScoreBreakdown[];
  statusMessage: string;
}

export type ClientGameEvent =
  | {
      id: string;
      type: 'TRAIN_CARD_DRAWN';
      playerId: string;
      playerName: string;
      source: 'faceUp' | 'hidden';
      cardColor?: TrainCardColor;
      turnCompleted: boolean;
      message: string;
    }
  | {
      id: string;
      type: 'DESTINATION_TICKETS';
      playerId: string;
      playerName: string;
      mode: 'setup' | 'turn';
      stage: 'started' | 'completed';
      message: string;
    }
  | {
      id: string;
      type: 'FACE_UP_TRAIN_CARDS_REFRESHED';
      message: string;
    };

export type ClientMessage =
  | { type: 'JOIN_GAME'; name: string }
  | { type: 'SET_STARTING_TRAINS'; value: number }
  | { type: 'START_GAME' }
  | { type: 'RESET_GAME' }
  | { type: 'DRAW_FACE_UP_CARD'; index: number }
  | { type: 'DRAW_HIDDEN_CARD' }
  | { type: 'SELECT_ROUTE'; routeId: string }
  | { type: 'CHOOSE_ROUTE_PAYMENT'; routeId: string; payment: PaymentOption }
  | { type: 'RESOLVE_TUNNEL'; pay: boolean }
  | { type: 'DRAW_DESTINATION_TICKETS' }
  | { type: 'KEEP_DESTINATION_TICKETS'; ticketIds: string[] }
  | { type: 'BEGIN_PLACE_STATION' }
  | { type: 'SELECT_STATION_CITY'; cityId: string }
  | { type: 'CHOOSE_STATION_PAYMENT'; cityId: string; payment: PaymentOption }
  | { type: 'CANCEL_ROUTE_CLAIM' }
  | { type: 'CANCEL_STATION_PLACEMENT' }
  | { type: 'END_TURN' };

export type ServerMessage =
  | { type: 'PLAYER_ASSIGNED'; playerId: string; sessionToken: string }
  | { type: 'STATE'; view: ClientGameView }
  | { type: 'GAME_EVENT'; event: ClientGameEvent }
  | { type: 'ACTION_REJECTED'; message: string };
