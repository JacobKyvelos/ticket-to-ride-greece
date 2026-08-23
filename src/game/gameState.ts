import type { Route } from '../types/map';
import { greeceDestinationTickets } from '../data/tickets/greeceTickets';
import type { DestinationTicket, GameState, PaymentOption, Player } from './gameTypes';
import { getRouteScore } from './scoring';
import {
  addCardToHand,
  createEmptyHand,
  createTrainDeck,
  dealCards,
  drawTunnelRevealCards,
  getTunnelExtraCost,
  getLegalTunnelExtraPaymentOptions,
  getLegalPaymentOptions,
  getLegalWildcardPaymentOptions,
  maintainFaceUpCards,
  paymentToDiscardPile,
  shuffleCards,
  spendTrainCards,
} from './trainCards';

const STARTING_TRAINS = 45;
const STARTING_HAND_SIZE = 4;
const STARTING_STATIONS = 3;

export interface InitialPlayerConfig {
  id: string;
  name: string;
  color: string;
}

const DEFAULT_PLAYERS: InitialPlayerConfig[] = [
  { id: 'player-1', name: 'Player 1', color: '#1f6f8b' },
  { id: 'player-2', name: 'Player 2', color: '#b23a48' },
];

interface InitialGameOptions {
  startingTrains?: number;
}

function createPlayers(playerConfigs: InitialPlayerConfig[], startingTrains: number): Player[] {
  return playerConfigs.map((player) => ({
    ...player,
    trainsRemaining: startingTrains,
    hand: createEmptyHand(),
    score: 0,
    destinationTickets: [],
    stationsRemaining: STARTING_STATIONS,
  }));
}

export const createInitialGameState = (
  playerConfigs: InitialPlayerConfig[] = DEFAULT_PLAYERS,
  options: InitialGameOptions = {},
): GameState => {
  const startingTrains = options.startingTrains ?? STARTING_TRAINS;
  let trainDeck = shuffleCards(createTrainDeck());
  let trainDiscardPile: GameState['trainDiscardPile'] = [];
  let destinationTicketDeck = shuffleCards(greeceDestinationTickets);
  let players = createPlayers(playerConfigs, startingTrains);

  for (let cardIndex = 0; cardIndex < STARTING_HAND_SIZE; cardIndex += 1) {
    players = players.map((player) => {
      const result = dealCards(1, { trainDeck, trainDiscardPile });
      trainDeck = result.trainDeck;
      trainDiscardPile = result.trainDiscardPile;

      return result.cards[0]
        ? { ...player, hand: addCardToHand(player.hand, result.cards[0]) }
        : player;
    });
  }

  const faceUpResult = maintainFaceUpCards([], { trainDeck, trainDiscardPile });
  const firstSetupPlayer = players[0];
  const firstTicketDraw = drawDestinationTickets(destinationTicketDeck, 3);
  destinationTicketDeck = firstTicketDraw.destinationTicketDeck;

  return {
    players,
    currentPlayerId: firstSetupPlayer.id,
    gamePhase: 'initialTickets',
    routeOwnership: {},
    stationOwnership: {},
    trainDeck: faceUpResult.trainDeck,
    trainDiscardPile: faceUpResult.trainDiscardPile,
    faceUpTrainCards: faceUpResult.faceUpTrainCards,
    cardsDrawnThisTurn: 0,
    trainDrawSourcesThisTurn: [],
    deckOnlyDrawStreakByPlayer: Object.fromEntries(players.map((player) => [player.id, 0])),
    deckOnlyDrawRefreshCount: 0,
    turnAction: 'none',
    destinationTicketDeck,
    pendingDestinationTicketSelection: {
      mode: 'setup',
      playerId: firstSetupPlayer.id,
      tickets: firstTicketDraw.tickets,
      minKeep: 2,
    },
    setupPlayerIndex: 0,
    finalTurnsRemaining: 0,
    statusMessage: '',
  };
};

export type GameAction =
  | { type: 'beginClaimRoute'; routeId: string; routes: Route[] }
  | { type: 'chooseClaimPayment'; routeId: string; routes: Route[]; payment: PaymentOption }
  | { type: 'resolveTunnelAttempt'; routes: Route[]; extraPayment?: PaymentOption }
  | { type: 'cancelClaim' }
  | { type: 'drawFaceUpCard'; index: number }
  | { type: 'drawDeckCard' }
  | { type: 'beginDrawDestinationTickets' }
  | { type: 'confirmDestinationTickets'; keptTicketIds: string[] }
  | { type: 'beginPlaceStation' }
  | { type: 'selectStationCity'; cityId: string }
  | { type: 'chooseStationPayment'; cityId: string; payment: PaymentOption }
  | { type: 'cancelStationPlacement' }
  | { type: 'endTurn' }
  | { type: 'resetGame' };

function drawDestinationTickets(destinationTicketDeck: DestinationTicket[], count: number) {
  return {
    tickets: destinationTicketDeck.slice(0, count),
    destinationTicketDeck: destinationTicketDeck.slice(count),
  };
}

function getCurrentPlayer(state: GameState) {
  return state.players.find((player) => player.id === state.currentPlayerId);
}

function advanceTurn(state: GameState, statusMessage?: string): GameState {
  const currentIndex = state.players.findIndex((player) => player.id === state.currentPlayerId);
  const nextPlayer = state.players[(currentIndex + 1) % state.players.length] ?? state.players[0];

  return {
    ...state,
    currentPlayerId: nextPlayer.id,
    cardsDrawnThisTurn: 0,
    trainDrawSourcesThisTurn: [],
    turnAction: 'none',
    pendingClaim: undefined,
    pendingTunnelAttempt: undefined,
    pendingStationPlacement: undefined,
    pendingDestinationTicketSelection: undefined,
    statusMessage: statusMessage ?? `Current turn: ${nextPlayer.name}`,
  };
}

function finishTurn(state: GameState, completedTurnPlayerId: string, statusMessage?: string): GameState {
  const completedPlayer = state.players.find((player) => player.id === completedTurnPlayerId);

  if (state.gamePhase === 'finalRound') {
    const finalTurnsRemaining = state.finalTurnsRemaining - 1;

    if (finalTurnsRemaining <= 0) {
      return {
        ...state,
        gamePhase: 'finished',
        finalTurnsRemaining: 0,
        cardsDrawnThisTurn: 0,
        trainDrawSourcesThisTurn: [],
        turnAction: 'none',
        pendingClaim: undefined,
        pendingTunnelAttempt: undefined,
        pendingStationPlacement: undefined,
        pendingDestinationTicketSelection: undefined,
        statusMessage: 'Game finished. Final scores are ready.',
      };
    }

    return {
      ...advanceTurn(state, statusMessage),
      gamePhase: 'finalRound',
      finalRoundTriggerPlayerId: state.finalRoundTriggerPlayerId,
      finalTurnsRemaining,
    };
  }

  if (state.gamePhase === 'playing' && completedPlayer && completedPlayer.trainsRemaining <= 2) {
    return {
      ...advanceTurn(
        {
          ...state,
          gamePhase: 'finalRound',
          finalRoundTriggerPlayerId: completedTurnPlayerId,
          finalTurnsRemaining: state.players.length,
        },
        `${completedPlayer.name} triggered the final round.`,
      ),
      gamePhase: 'finalRound',
      finalRoundTriggerPlayerId: completedTurnPlayerId,
      finalTurnsRemaining: state.players.length,
    };
  }

  return advanceTurn(state, statusMessage);
}

function canTakeTurnAction(state: GameState) {
  return state.gamePhase === 'playing' || state.gamePhase === 'finalRound';
}

function updateDeckOnlyDrawStreakAfterTrainDraw(state: GameState, playerId: string): GameState {
  const drewOnlyFromDeck =
    state.trainDrawSourcesThisTurn.length > 0 &&
    state.trainDrawSourcesThisTurn.every((source) => source === 'deck');
  const deckOnlyDrawStreakByPlayer = Object.fromEntries(
    state.players.map((player) => [
      player.id,
      player.id === playerId
        ? drewOnlyFromDeck
          ? (state.deckOnlyDrawStreakByPlayer[player.id] ?? 0) + 1
          : 0
        : state.deckOnlyDrawStreakByPlayer[player.id] ?? 0,
    ]),
  );
  const allPlayersReachedThreshold =
    state.players.length > 0 &&
    state.players.every((player) => (deckOnlyDrawStreakByPlayer[player.id] ?? 0) >= 2);

  if (!allPlayersReachedThreshold) {
    return {
      ...state,
      deckOnlyDrawStreakByPlayer,
    };
  }

  const refreshed = maintainFaceUpCards([], {
    trainDeck: state.trainDeck,
    trainDiscardPile: [...state.trainDiscardPile, ...state.faceUpTrainCards],
  });

  return {
    ...state,
    trainDeck: refreshed.trainDeck,
    trainDiscardPile: refreshed.trainDiscardPile,
    faceUpTrainCards: refreshed.faceUpTrainCards,
    deckOnlyDrawStreakByPlayer: Object.fromEntries(state.players.map((player) => [player.id, 0])),
    deckOnlyDrawRefreshCount: state.deckOnlyDrawRefreshCount + 1,
  };
}

function claimRouteWithPayments(
  state: GameState,
  route: Route,
  payments: PaymentOption[],
  revealedTunnelCards: GameState['trainDiscardPile'] = [],
): GameState {
  const currentPlayer = getCurrentPlayer(state);

  if (!currentPlayer) {
    return {
      ...state,
      statusMessage: 'Current player was not found.',
    };
  }

  const players = state.players.map((player) =>
    player.id === currentPlayer.id
      ? {
          ...player,
          trainsRemaining: player.trainsRemaining - route.length,
          score: player.score + getRouteScore(route.length),
          hand: payments.reduce((hand, payment) => spendTrainCards(hand, payment), player.hand),
        }
      : player,
  );
  const spentCards = payments.flatMap(paymentToDiscardPile);

  const nextState = finishTurn(
    {
      ...state,
      players,
      routeOwnership: {
        ...state.routeOwnership,
        [route.id]: currentPlayer.id,
      },
      trainDiscardPile: [...state.trainDiscardPile, ...revealedTunnelCards, ...spentCards],
      pendingClaim: undefined,
      pendingTunnelAttempt: undefined,
    },
    currentPlayer.id,
    `${currentPlayer.name} claimed ${route.id}.`,
  );

  return nextState;
}

function claimRouteWithPayment(
  state: GameState,
  route: Route,
  payment: PaymentOption,
): GameState {
  return claimRouteWithPayments(state, route, [payment]);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'beginClaimRoute': {
      if (!canTakeTurnAction(state)) {
        return {
          ...state,
          statusMessage:
            state.gamePhase === 'finished'
              ? 'The game is finished. Reset to play again.'
              : 'Finish initial destination ticket selection first.',
        };
      }

      if (state.turnAction === 'claimRoute') {
        return {
          ...state,
          statusMessage: state.pendingTunnelAttempt
            ? 'Resolve the tunnel attempt before taking another action.'
            : 'Finish or cancel the current route claim first.',
        };
      }

      if (state.turnAction === 'drawTrainCards') {
        return {
          ...state,
          statusMessage: 'Finish drawing train cards before claiming a route.',
        };
      }

      if (state.turnAction === 'drawDestinationTickets') {
        return {
          ...state,
          statusMessage: 'Finish drawing destination tickets before claiming a route.',
        };
      }

      if (state.turnAction === 'placeStation') {
        return {
          ...state,
          statusMessage: 'Finish or cancel station placement before claiming a route.',
        };
      }

      const route = action.routes.find((candidate) => candidate.id === action.routeId);

      if (!route) {
        return {
          ...state,
          statusMessage: `Route not found: ${action.routeId}`,
        };
      }

      if (state.routeOwnership[route.id]) {
        return {
          ...state,
          pendingClaim: undefined,
          statusMessage: `${route.id} is already claimed.`,
        };
      }

      const currentPlayer = getCurrentPlayer(state);

      if (!currentPlayer) {
        return {
          ...state,
          statusMessage: 'Current player was not found.',
        };
      }

      if (currentPlayer.trainsRemaining < route.length) {
        return {
          ...state,
          pendingClaim: undefined,
          statusMessage: `${currentPlayer.name} needs ${route.length} trains to claim ${route.id}.`,
        };
      }

      const paymentOptions = getLegalPaymentOptions(route, currentPlayer.hand);

      if (paymentOptions.length === 0) {
        return {
          ...state,
          pendingClaim: undefined,
          statusMessage: `${currentPlayer.name} does not have the cards for ${route.id}.`,
        };
      }

      if (route.type === 'tunnel' || route.type === 'ferry' || paymentOptions.length > 1) {
        return {
          ...state,
          turnAction: 'claimRoute',
          pendingClaim: {
            routeId: route.id,
            paymentOptions,
          },
          statusMessage:
            route.type === 'tunnel'
              ? `Choose base payment for tunnel ${route.id}.`
              : `Choose payment for ${route.id}.`,
        };
      }

      return claimRouteWithPayment(
        { ...state, turnAction: 'claimRoute', pendingClaim: undefined },
        route,
        paymentOptions[0],
      );
    }

    case 'chooseClaimPayment': {
      const route = action.routes.find((candidate) => candidate.id === action.routeId);

      if (!route) {
        return {
          ...state,
          pendingClaim: undefined,
          turnAction: 'none',
          statusMessage: `Route not found: ${action.routeId}`,
        };
      }

      if (state.routeOwnership[route.id]) {
        return {
          ...state,
          pendingClaim: undefined,
          turnAction: 'none',
          statusMessage: `${route.id} is already claimed.`,
        };
      }

      if (route.type === 'tunnel') {
        const currentPlayer = getCurrentPlayer(state);

        if (!currentPlayer) {
          return {
            ...state,
            statusMessage: 'Current player was not found.',
          };
        }

        const revealResult = drawTunnelRevealCards({
          trainDeck: state.trainDeck,
          trainDiscardPile: state.trainDiscardPile,
        });
        const handAfterBasePayment = spendTrainCards(currentPlayer.hand, action.payment);
        const extraCost = getTunnelExtraCost(action.payment, revealResult.revealedCards);
        const extraPaymentOptions = getLegalTunnelExtraPaymentOptions(
          action.payment,
          extraCost,
          handAfterBasePayment,
        );

        return {
          ...state,
          trainDeck: revealResult.trainDeck,
          trainDiscardPile: revealResult.trainDiscardPile,
          pendingClaim: undefined,
          pendingTunnelAttempt: {
            routeId: route.id,
            playerId: currentPlayer.id,
            basePayment: action.payment,
            revealedCards: revealResult.revealedCards,
            extraCost,
            extraPaymentOptions,
          },
          statusMessage: `Tunnel revealed ${extraCost} extra card${extraCost === 1 ? '' : 's'}.`,
        };
      }

      return claimRouteWithPayment(state, route, action.payment);
    }

    case 'resolveTunnelAttempt': {
      const tunnelAttempt = state.pendingTunnelAttempt;

      if (!tunnelAttempt) {
        return {
          ...state,
          statusMessage: 'No tunnel attempt is pending.',
        };
      }

      const route = action.routes.find((candidate) => candidate.id === tunnelAttempt.routeId);

      if (!route) {
        return finishTurn(
          {
            ...state,
            trainDiscardPile: [...state.trainDiscardPile, ...tunnelAttempt.revealedCards],
            pendingTunnelAttempt: undefined,
            pendingClaim: undefined,
          },
          tunnelAttempt.playerId,
          `Route not found: ${tunnelAttempt.routeId}`,
        );
      }

      if (!action.extraPayment) {
        return finishTurn(
          {
            ...state,
            trainDiscardPile: [...state.trainDiscardPile, ...tunnelAttempt.revealedCards],
            pendingTunnelAttempt: undefined,
            pendingClaim: undefined,
          },
          tunnelAttempt.playerId,
          `${tunnelAttempt.playerId} declined the tunnel extra cost.`,
        );
      }

      return claimRouteWithPayments(
        state,
        route,
        [tunnelAttempt.basePayment, action.extraPayment],
        tunnelAttempt.revealedCards,
      );
    }

    case 'cancelClaim':
      if (state.pendingTunnelAttempt) {
        return {
          ...state,
          statusMessage: 'Tunnel cards have been revealed, so this attempt must be resolved.',
        };
      }

      return {
        ...state,
        pendingClaim: undefined,
        turnAction: 'none',
        statusMessage: 'Route claim cancelled.',
      };

    case 'drawFaceUpCard': {
      if (!canTakeTurnAction(state)) {
        return {
          ...state,
          statusMessage:
            state.gamePhase === 'finished'
              ? 'The game is finished. Reset to play again.'
              : 'Finish initial destination ticket selection first.',
        };
      }

      if (state.turnAction === 'claimRoute') {
        return {
          ...state,
          statusMessage: 'Finish or cancel the route claim first.',
        };
      }

      if (state.turnAction === 'drawDestinationTickets') {
        return {
          ...state,
          statusMessage: 'Finish drawing destination tickets before drawing train cards.',
        };
      }

      if (state.turnAction === 'placeStation') {
        return {
          ...state,
          statusMessage: 'Finish or cancel station placement before drawing train cards.',
        };
      }

      const selectedCard = state.faceUpTrainCards[action.index];

      if (!selectedCard) {
        return {
          ...state,
          statusMessage: 'No train card is available in that slot.',
        };
      }

      if (selectedCard === 'locomotive' && state.cardsDrawnThisTurn > 0) {
        return {
          ...state,
          statusMessage: 'A face-up locomotive can only be taken as the first draw.',
        };
      }

      if (state.cardsDrawnThisTurn >= 2) {
        return {
          ...state,
          statusMessage: 'No more train cards can be drawn this turn.',
        };
      }

      const currentPlayer = getCurrentPlayer(state);

      if (!currentPlayer) {
        return {
          ...state,
          statusMessage: 'Current player was not found.',
        };
      }

      const players = state.players.map((player) =>
        player.id === currentPlayer.id
          ? { ...player, hand: addCardToHand(player.hand, selectedCard) }
          : player,
      );
      const faceUpTrainCards = state.faceUpTrainCards.filter((_, index) => index !== action.index);
      const refillResult = maintainFaceUpCards(faceUpTrainCards, {
        trainDeck: state.trainDeck,
        trainDiscardPile: state.trainDiscardPile,
      });
      const cardsDrawnThisTurn =
        selectedCard === 'locomotive' ? 2 : state.cardsDrawnThisTurn + 1;
      const trainDrawSourcesThisTurn = [...state.trainDrawSourcesThisTurn, 'faceUp' as const];
      const updatedState: GameState = {
        ...state,
        players,
        trainDeck: refillResult.trainDeck,
        trainDiscardPile: refillResult.trainDiscardPile,
        faceUpTrainCards: refillResult.faceUpTrainCards,
        cardsDrawnThisTurn,
        trainDrawSourcesThisTurn,
        turnAction: 'drawTrainCards',
        statusMessage: `${currentPlayer.name} drew a ${selectedCard} train card.`,
      };

      return cardsDrawnThisTurn >= 2
        ? finishTurn(
            updateDeckOnlyDrawStreakAfterTrainDraw(updatedState, currentPlayer.id),
            currentPlayer.id,
            `${currentPlayer.name} finished drawing train cards.`,
          )
        : updatedState;
    }

    case 'drawDeckCard': {
      if (!canTakeTurnAction(state)) {
        return {
          ...state,
          statusMessage:
            state.gamePhase === 'finished'
              ? 'The game is finished. Reset to play again.'
              : 'Finish initial destination ticket selection first.',
        };
      }

      if (state.turnAction === 'claimRoute') {
        return {
          ...state,
          statusMessage: 'Finish or cancel the route claim first.',
        };
      }

      if (state.turnAction === 'drawDestinationTickets') {
        return {
          ...state,
          statusMessage: 'Finish drawing destination tickets before drawing train cards.',
        };
      }

      if (state.turnAction === 'placeStation') {
        return {
          ...state,
          statusMessage: 'Finish or cancel station placement before drawing train cards.',
        };
      }

      if (state.cardsDrawnThisTurn >= 2) {
        return {
          ...state,
          statusMessage: 'No more train cards can be drawn this turn.',
        };
      }

      const currentPlayer = getCurrentPlayer(state);

      if (!currentPlayer) {
        return {
          ...state,
          statusMessage: 'Current player was not found.',
        };
      }

      const result = dealCards(1, {
        trainDeck: state.trainDeck,
        trainDiscardPile: state.trainDiscardPile,
      });
      const drawnCard = result.cards[0];

      if (!drawnCard) {
        return {
          ...state,
          statusMessage: 'No train cards are available to draw.',
        };
      }

      const players = state.players.map((player) =>
        player.id === currentPlayer.id
          ? { ...player, hand: addCardToHand(player.hand, drawnCard) }
          : player,
      );
      const cardsDrawnThisTurn = state.cardsDrawnThisTurn + 1;
      const trainDrawSourcesThisTurn = [...state.trainDrawSourcesThisTurn, 'deck' as const];
      const updatedState: GameState = {
        ...state,
        players,
        trainDeck: result.trainDeck,
        trainDiscardPile: result.trainDiscardPile,
        cardsDrawnThisTurn,
        trainDrawSourcesThisTurn,
        turnAction: 'drawTrainCards',
        statusMessage: `${currentPlayer.name} drew from the deck.`,
      };

      return cardsDrawnThisTurn >= 2
        ? finishTurn(
            updateDeckOnlyDrawStreakAfterTrainDraw(updatedState, currentPlayer.id),
            currentPlayer.id,
            `${currentPlayer.name} finished drawing train cards.`,
          )
        : updatedState;
    }

    case 'beginDrawDestinationTickets': {
      if (!canTakeTurnAction(state)) {
        return {
          ...state,
          statusMessage:
            state.gamePhase === 'finished'
              ? 'The game is finished. Reset to play again.'
              : 'Finish initial destination ticket selection first.',
        };
      }

      if (state.turnAction !== 'none') {
        return {
          ...state,
          statusMessage: 'Only one action type can be taken per turn.',
        };
      }

      if (state.destinationTicketDeck.length === 0) {
        return {
          ...state,
          statusMessage: 'No destination tickets are available.',
        };
      }

      const result = drawDestinationTickets(state.destinationTicketDeck, 3);

      return {
        ...state,
        destinationTicketDeck: result.destinationTicketDeck,
        turnAction: 'drawDestinationTickets',
        pendingDestinationTicketSelection: {
          mode: 'turn',
          playerId: state.currentPlayerId,
          tickets: result.tickets,
          minKeep: 1,
        },
        statusMessage: 'Choose at least 1 destination ticket to keep.',
      };
    }

    case 'confirmDestinationTickets': {
      const pendingSelection = state.pendingDestinationTicketSelection;

      if (!pendingSelection) {
        return {
          ...state,
          statusMessage: 'No destination tickets are pending.',
        };
      }

      const keptTickets = pendingSelection.tickets.filter((ticket) =>
        action.keptTicketIds.includes(ticket.id),
      );

      if (keptTickets.length < pendingSelection.minKeep) {
        return {
          ...state,
          statusMessage: `Keep at least ${pendingSelection.minKeep} destination ticket${
            pendingSelection.minKeep === 1 ? '' : 's'
          }.`,
        };
      }

      const rejectedTickets = pendingSelection.tickets.filter(
        (ticket) => !action.keptTicketIds.includes(ticket.id),
      );
      const players = state.players.map((player) =>
        player.id === pendingSelection.playerId
          ? { ...player, destinationTickets: [...player.destinationTickets, ...keptTickets] }
          : player,
      );

      if (pendingSelection.mode === 'setup') {
        const nextSetupPlayerIndex = state.setupPlayerIndex + 1;
        const nextSetupPlayer = players[nextSetupPlayerIndex];
        let destinationTicketDeck = [...state.destinationTicketDeck, ...rejectedTickets];

        if (nextSetupPlayer) {
          const result = drawDestinationTickets(destinationTicketDeck, 3);
          destinationTicketDeck = result.destinationTicketDeck;

          return {
            ...state,
            players,
            currentPlayerId: nextSetupPlayer.id,
            destinationTicketDeck,
            pendingDestinationTicketSelection: {
              mode: 'setup',
              playerId: nextSetupPlayer.id,
              tickets: result.tickets,
              minKeep: 2,
            },
            setupPlayerIndex: nextSetupPlayerIndex,
            statusMessage: `${nextSetupPlayer.name}, choose at least 2 destination tickets.`,
          };
        }

        return {
          ...state,
          players,
          currentPlayerId: players[0]?.id ?? state.currentPlayerId,
          gamePhase: 'playing',
          destinationTicketDeck,
          pendingDestinationTicketSelection: undefined,
          setupPlayerIndex: 0,
          turnAction: 'none',
          statusMessage: `Initial destination tickets selected. ${players[0]?.name ?? 'First player'} begins.`,
        };
      }

      return finishTurn(
        {
          ...state,
          players,
          destinationTicketDeck: [...state.destinationTicketDeck, ...rejectedTickets],
          pendingDestinationTicketSelection: undefined,
        },
        pendingSelection.playerId,
        `${getCurrentPlayer(state)?.name ?? 'Player'} kept ${keptTickets.length} destination ticket${
          keptTickets.length === 1 ? '' : 's'
        }.`,
      );
    }

    case 'beginPlaceStation': {
      if (!canTakeTurnAction(state)) {
        return {
          ...state,
          statusMessage:
            state.gamePhase === 'finished'
              ? 'The game is finished. Reset to play again.'
              : 'Finish initial destination ticket selection first.',
        };
      }

      if (state.turnAction !== 'none') {
        return {
          ...state,
          statusMessage: 'Only one action type can be taken per turn.',
        };
      }

      const currentPlayer = getCurrentPlayer(state);

      if (!currentPlayer) {
        return {
          ...state,
          statusMessage: 'Current player was not found.',
        };
      }

      if (currentPlayer.stationsRemaining <= 0) {
        return {
          ...state,
          statusMessage: `${currentPlayer.name} has no stations remaining.`,
        };
      }

      return {
        ...state,
        turnAction: 'placeStation',
        pendingStationPlacement: {
          paymentOptions: [],
        },
        statusMessage: 'Choose a city for the station.',
      };
    }

    case 'selectStationCity': {
      if (state.turnAction !== 'placeStation' || !state.pendingStationPlacement) {
        return {
          ...state,
          statusMessage: 'Choose Place Station before selecting a city.',
        };
      }

      if (state.stationOwnership[action.cityId]) {
        return {
          ...state,
          statusMessage: 'That city already has a station.',
        };
      }

      const currentPlayer = getCurrentPlayer(state);

      if (!currentPlayer) {
        return {
          ...state,
          statusMessage: 'Current player was not found.',
        };
      }

      const stationCost = STARTING_STATIONS - currentPlayer.stationsRemaining + 1;
      const paymentOptions = getLegalWildcardPaymentOptions(stationCost, currentPlayer.hand);

      if (paymentOptions.length === 0) {
        return {
          ...state,
          pendingStationPlacement: {
            paymentOptions: [],
          },
          statusMessage: `${currentPlayer.name} needs ${stationCost} matching card${
            stationCost === 1 ? '' : 's'
          } to place a station.`,
        };
      }

      return {
        ...state,
        pendingStationPlacement: {
          cityId: action.cityId,
          paymentOptions,
        },
        statusMessage: `Choose payment to place a station at ${action.cityId}.`,
      };
    }

    case 'chooseStationPayment': {
      if (state.turnAction !== 'placeStation' || !state.pendingStationPlacement) {
        return {
          ...state,
          statusMessage: 'No station placement is pending.',
        };
      }

      if (state.stationOwnership[action.cityId]) {
        return {
          ...state,
          statusMessage: 'That city already has a station.',
        };
      }

      const currentPlayer = getCurrentPlayer(state);

      if (!currentPlayer) {
        return {
          ...state,
          statusMessage: 'Current player was not found.',
        };
      }

      if (currentPlayer.stationsRemaining <= 0) {
        return {
          ...state,
          statusMessage: `${currentPlayer.name} has no stations remaining.`,
        };
      }

      const players = state.players.map((player) =>
        player.id === currentPlayer.id
          ? {
              ...player,
              stationsRemaining: player.stationsRemaining - 1,
              hand: spendTrainCards(player.hand, action.payment),
            }
          : player,
      );

      return finishTurn(
        {
          ...state,
          players,
          stationOwnership: {
            ...state.stationOwnership,
            [action.cityId]: currentPlayer.id,
          },
          trainDiscardPile: [...state.trainDiscardPile, ...paymentToDiscardPile(action.payment)],
          pendingStationPlacement: undefined,
        },
        currentPlayer.id,
        `${currentPlayer.name} placed a station at ${action.cityId}.`,
      );
    }

    case 'cancelStationPlacement':
      return {
        ...state,
        turnAction: 'none',
        pendingStationPlacement: undefined,
        statusMessage: 'Station placement cancelled.',
      };

    case 'endTurn':
      if (!canTakeTurnAction(state)) {
        return {
          ...state,
          statusMessage:
            state.gamePhase === 'finished'
              ? 'The game is finished. Reset to play again.'
              : 'Finish initial destination ticket selection first.',
        };
      }

      if (
        state.pendingClaim ||
        state.pendingTunnelAttempt ||
        state.pendingDestinationTicketSelection ||
        state.pendingStationPlacement
      ) {
        return {
          ...state,
          statusMessage: 'Finish or cancel the pending action before ending the turn.',
        };
      }

      return finishTurn(state, state.currentPlayerId);

    case 'resetGame':
      return createInitialGameState();

    default:
      return state;
  }
}
