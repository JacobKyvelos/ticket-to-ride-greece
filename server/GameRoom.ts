import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import { greeceMapData } from '../src/data/maps/greeceStatic.js';
import type { GameState, PaymentOption, Player, TrainCardColor } from '../src/game/gameTypes.js';
import { createInitialGameState, gameReducer, type InitialPlayerConfig } from '../src/game/gameState.js';
import { getTotalRouteSpaces } from '../src/game/mapRules.js';
import {
  calculateDestinationTicketBreakdown,
  calculateFinalScores,
  calculatePlayerScoreBreakdown,
} from '../src/game/scoring.js';
import { countCards } from '../src/game/trainCards.js';
import type {
  ClientGameEvent,
  ClientGameView,
  ClientMessage,
  LobbyPlayerView,
  ServerMessage,
} from '../shared/protocol.js';

const PLAYER_COLORS = ['#1f6f8b', '#b23a48', '#6b8e23', '#6f4da8', '#b7791f'];
const STANDARD_STARTING_TRAINS = 45;
const MIN_STARTING_TRAINS = 1;

interface Connection {
  socket: WebSocket;
  playerId?: string;
  sessionToken?: string;
}

interface LobbyPlayer extends InitialPlayerConfig {
  isHost: boolean;
  sessionToken: string;
}

export class GameRoom {
  private connections = new Map<WebSocket, Connection>();
  private lobbyPlayers: LobbyPlayer[] = [];
  private state?: GameState;
  private gameConfig = {
    startingTrains: STANDARD_STARTING_TRAINS,
  };
  private readonly maxStartingTrains = getTotalRouteSpaces(greeceMapData.routes);

  addConnection(socket: WebSocket) {
    this.connections.set(socket, { socket });
    this.sendView(socket);
  }

  removeConnection(socket: WebSocket) {
    this.connections.delete(socket);
  }

  handleMessage(socket: WebSocket, message: ClientMessage) {
    const connection = this.connections.get(socket);

    if (!connection) {
      return;
    }

    try {
      if (message.type === 'JOIN_GAME') {
        this.join(connection, message.name);
        return;
      }

      if (!connection.playerId) {
        this.reject(socket, 'Join the game first.');
        return;
      }

      if (message.type === 'START_GAME') {
        this.startGame(connection);
        return;
      }

      if (message.type === 'SET_STARTING_TRAINS') {
        this.setStartingTrains(connection, message.value);
        return;
      }

      if (message.type === 'RESET_GAME') {
        this.resetGame(connection);
        return;
      }

      this.dispatchPlayerAction(connection, message);
    } catch (error) {
      this.reject(socket, error instanceof Error ? error.message : 'Action failed.');
    }
  }

  private join(connection: Connection, rawName: string) {
    if (connection.playerId) {
      this.reject(connection.socket, 'This browser has already joined.');
      return;
    }

    if (this.state) {
      this.reject(connection.socket, 'Game already started. Reconnect support is not implemented yet.');
      return;
    }

    if (this.lobbyPlayers.length >= 5) {
      this.reject(connection.socket, 'This game already has 5 players.');
      return;
    }

    const playerId = `p_${randomUUID().slice(0, 8)}`;
    const sessionToken = randomUUID();
    const player: LobbyPlayer = {
      id: playerId,
      name: rawName.trim() || `Player ${this.lobbyPlayers.length + 1}`,
      color: PLAYER_COLORS[this.lobbyPlayers.length],
      isHost: this.lobbyPlayers.length === 0,
      sessionToken,
    };

    connection.playerId = playerId;
    connection.sessionToken = sessionToken;
    this.lobbyPlayers.push(player);
    this.send(connection.socket, { type: 'PLAYER_ASSIGNED', playerId, sessionToken });
    this.broadcastViews();
  }

  private startGame(connection: Connection) {
    if (!this.isHost(connection.playerId)) {
      this.reject(connection.socket, 'Only the host can start the game.');
      return;
    }

    if (this.lobbyPlayers.length < 2) {
      this.reject(connection.socket, 'At least 2 players are required.');
      return;
    }

    this.state = createInitialGameState(this.lobbyPlayers, {
      startingTrains: this.gameConfig.startingTrains,
    });
    this.broadcastViews();
    this.broadcastInitialDestinationSelectionStarted();
  }

  private setStartingTrains(connection: Connection, rawValue: number) {
    if (!this.isHost(connection.playerId)) {
      this.reject(connection.socket, 'Only the host can change game setup.');
      return;
    }

    if (this.state) {
      this.reject(connection.socket, 'Starting trains cannot be changed after the game starts.');
      return;
    }

    if (!Number.isInteger(rawValue)) {
      this.reject(connection.socket, 'Starting trains must be a whole number.');
      return;
    }

    if (rawValue < MIN_STARTING_TRAINS || rawValue > this.maxStartingTrains) {
      this.reject(
        connection.socket,
        `Starting trains must be between ${MIN_STARTING_TRAINS} and ${this.maxStartingTrains}.`,
      );
      return;
    }

    this.gameConfig = {
      ...this.gameConfig,
      startingTrains: rawValue,
    };
    this.broadcastViews();
  }

  private resetGame(connection: Connection) {
    if (!this.isHost(connection.playerId)) {
      this.reject(connection.socket, 'Only the host can reset the game.');
      return;
    }

    this.state =
      this.lobbyPlayers.length >= 2
        ? createInitialGameState(this.lobbyPlayers, {
            startingTrains: this.gameConfig.startingTrains,
          })
        : undefined;
    this.broadcastViews();
    this.broadcastInitialDestinationSelectionStarted();
  }

  private dispatchPlayerAction(connection: Connection, message: ClientMessage) {
    if (!this.state) {
      this.reject(connection.socket, 'The game has not started yet.');
      return;
    }

    const playerId = connection.playerId;

    if (!playerId) {
      this.reject(connection.socket, 'Join the game first.');
      return;
    }

    if (!this.canActAs(playerId, message)) {
      this.reject(connection.socket, 'It is not your turn or private action.');
      return;
    }

    const previousState = this.state;
    const drawEvent =
      message.type === 'DRAW_FACE_UP_CARD' || message.type === 'DRAW_HIDDEN_CARD'
        ? this.createTrainDrawEventSeed(previousState, message)
        : undefined;
    const pendingDestinationSelection =
      message.type === 'KEEP_DESTINATION_TICKETS'
        ? previousState.pendingDestinationTicketSelection
        : undefined;

    switch (message.type) {
      case 'DRAW_FACE_UP_CARD':
        this.state = gameReducer(this.state, { type: 'drawFaceUpCard', index: message.index });
        break;
      case 'DRAW_HIDDEN_CARD':
        this.state = gameReducer(this.state, { type: 'drawDeckCard' });
        break;
      case 'SELECT_ROUTE':
        this.state = gameReducer(this.state, {
          type: 'beginClaimRoute',
          routeId: message.routeId,
          routes: greeceMapData.routes,
        });
        break;
      case 'CHOOSE_ROUTE_PAYMENT':
        this.assertPaymentOffered(message.payment, this.state.pendingClaim?.paymentOptions);
        this.state = gameReducer(this.state, {
          type: 'chooseClaimPayment',
          routeId: message.routeId,
          routes: greeceMapData.routes,
          payment: message.payment,
        });
        break;
      case 'RESOLVE_TUNNEL': {
        const extraPayment = message.pay
          ? this.state.pendingTunnelAttempt?.extraPaymentOptions[0]
          : undefined;
        this.state = gameReducer(this.state, {
          type: 'resolveTunnelAttempt',
          routes: greeceMapData.routes,
          extraPayment,
        });
        break;
      }
      case 'DRAW_DESTINATION_TICKETS':
        this.state = gameReducer(this.state, { type: 'beginDrawDestinationTickets' });
        break;
      case 'KEEP_DESTINATION_TICKETS':
        this.state = gameReducer(this.state, {
          type: 'confirmDestinationTickets',
          keptTicketIds: message.ticketIds,
        });
        break;
      case 'BEGIN_PLACE_STATION':
        this.state = gameReducer(this.state, { type: 'beginPlaceStation' });
        break;
      case 'SELECT_STATION_CITY':
        this.state = gameReducer(this.state, { type: 'selectStationCity', cityId: message.cityId });
        break;
      case 'CHOOSE_STATION_PAYMENT':
        this.assertPaymentOffered(message.payment, this.state.pendingStationPlacement?.paymentOptions);
        this.state = gameReducer(this.state, {
          type: 'chooseStationPayment',
          cityId: message.cityId,
          payment: message.payment,
        });
        break;
      case 'CANCEL_ROUTE_CLAIM':
        this.state = gameReducer(this.state, { type: 'cancelClaim' });
        break;
      case 'CANCEL_STATION_PLACEMENT':
        this.state = gameReducer(this.state, { type: 'cancelStationPlacement' });
        break;
      case 'END_TURN':
        this.state = previousState;
        this.reject(connection.socket, 'Turns end automatically after a complete action.');
        return;
      default:
        this.state = previousState;
        this.reject(connection.socket, 'Unsupported action.');
        return;
    }

    this.broadcastViews();
    this.broadcastTrainDrawEvent(previousState, this.state, drawEvent);
    this.broadcastDeckOnlyFaceUpRefreshEvent(previousState, this.state);
    this.broadcastDestinationTicketEvent(previousState, this.state, message, pendingDestinationSelection);
  }

  private canActAs(playerId: string, message: ClientMessage) {
    if (!this.state) {
      return false;
    }

    if (message.type === 'KEEP_DESTINATION_TICKETS') {
      return this.state.pendingDestinationTicketSelection?.playerId === playerId;
    }

    if (message.type === 'RESOLVE_TUNNEL') {
      return this.state.pendingTunnelAttempt?.playerId === playerId;
    }

    return this.state.currentPlayerId === playerId;
  }

  private createPlayerView(viewerPlayerId?: string): ClientGameView {
    const lobbyPlayers = this.lobbyPlayers.map<LobbyPlayerView>((player) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      isHost: player.isHost,
    }));
    const isHost = this.isHost(viewerPlayerId);

    if (!this.state) {
      return {
        connectedPlayerId: viewerPlayerId,
        isHost,
        lobbyPlayers,
        gameConfig: this.createGameConfigView(),
        gamePhase: 'lobby',
        players: [],
        routeOwnership: {},
        stationOwnership: {},
        faceUpTrainCards: [],
        trainDeckCount: 0,
        trainDiscardCount: 0,
        destinationTicketDeckCount: 0,
        cardsDrawnThisTurn: 0,
        turnAction: 'none',
        finalTurnsRemaining: 0,
        statusMessage: 'Waiting in lobby.',
      };
    }

    const finalResults =
      this.state.gamePhase === 'finished'
        ? calculateFinalScores(
            this.state.players,
            this.state.routeOwnership,
            this.state.stationOwnership,
            greeceMapData.routes,
          )
        : undefined;

    return {
      connectedPlayerId: viewerPlayerId,
      isHost,
      lobbyPlayers,
      gameConfig: this.createGameConfigView(),
      gamePhase: this.state.gamePhase,
      currentPlayerId: this.state.currentPlayerId,
      players: this.state.players.map((player) => this.createPlayerSummary(player, viewerPlayerId)),
      routeOwnership: this.state.routeOwnership,
      stationOwnership: this.state.stationOwnership,
      faceUpTrainCards: this.state.faceUpTrainCards,
      trainDeckCount: this.state.trainDeck.length,
      trainDiscardCount: this.state.trainDiscardPile.length,
      destinationTicketDeckCount: this.state.destinationTicketDeck.length,
      cardsDrawnThisTurn: this.state.cardsDrawnThisTurn,
      turnAction: this.state.turnAction,
      pendingClaim:
        this.state.currentPlayerId === viewerPlayerId ? this.state.pendingClaim : undefined,
      pendingTunnelAttempt:
        this.state.pendingTunnelAttempt?.playerId === viewerPlayerId ||
        Boolean(this.state.pendingTunnelAttempt?.revealedCards.length)
          ? this.state.pendingTunnelAttempt
          : undefined,
      pendingStationPlacement:
        this.state.currentPlayerId === viewerPlayerId
          ? this.state.pendingStationPlacement
          : undefined,
      pendingDestinationTicketSelection:
        this.state.pendingDestinationTicketSelection?.playerId === viewerPlayerId
          ? this.state.pendingDestinationTicketSelection
          : undefined,
      finalRoundTriggerPlayerId: this.state.finalRoundTriggerPlayerId,
      finalTurnsRemaining: this.state.finalTurnsRemaining,
      finalResults,
      statusMessage: this.state.statusMessage,
    };
  }

  private createPlayerSummary(player: Player, viewerPlayerId?: string) {
    const isViewer = player.id === viewerPlayerId;
    const ticketResults =
      isViewer || this.state?.gamePhase === 'finished'
        ? calculateDestinationTicketBreakdown(
            player.id,
            player.destinationTickets,
            this.state?.routeOwnership ?? {},
            this.state?.stationOwnership ?? {},
            greeceMapData.routes,
          )
        : undefined;
    const scoreBreakdown =
      isViewer || this.state?.gamePhase === 'finished'
        ? calculatePlayerScoreBreakdown(
            player,
            this.state?.players ?? [],
            this.state?.routeOwnership ?? {},
            this.state?.stationOwnership ?? {},
            greeceMapData.routes,
          )
        : undefined;

    return {
      id: player.id,
      name: player.name,
      color: player.color,
      trainsRemaining: player.trainsRemaining,
      score: player.score,
      stationsRemaining: player.stationsRemaining,
      cardCount: countCards(player.hand),
      destinationTicketCount: player.destinationTickets.length,
      hand: isViewer ? player.hand : undefined,
      destinationTickets:
        isViewer || this.state?.gamePhase === 'finished' ? player.destinationTickets : undefined,
      ticketResults,
      scoreBreakdown,
    };
  }

  private broadcastViews() {
    for (const connection of this.connections.values()) {
      this.sendView(connection.socket);
    }
  }

  private sendView(socket: WebSocket) {
    const connection = this.connections.get(socket);
    this.send(socket, { type: 'STATE', view: this.createPlayerView(connection?.playerId) });
  }

  private reject(socket: WebSocket, message: string) {
    this.send(socket, { type: 'ACTION_REJECTED', message });
  }

  private send(socket: WebSocket, message: ServerMessage) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  private isHost(playerId?: string) {
    return Boolean(playerId && this.lobbyPlayers.find((player) => player.id === playerId)?.isHost);
  }

  private assertPaymentOffered(payment: PaymentOption, paymentOptions?: PaymentOption[]) {
    const offered = paymentOptions?.some(
      (option) =>
        option.paymentColor === payment.paymentColor &&
        option.normalCards === payment.normalCards &&
        option.locomotives === payment.locomotives,
    );

    if (!offered) {
      throw new Error('That payment option is not legal.');
    }
  }

  private createTrainDrawEventSeed(
    state: GameState,
    message: Extract<ClientMessage, { type: 'DRAW_FACE_UP_CARD' | 'DRAW_HIDDEN_CARD' }>,
  ) {
    const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);

    if (!player) {
      return undefined;
    }

    if (message.type === 'DRAW_FACE_UP_CARD') {
      const cardColor = state.faceUpTrainCards[message.index];

      if (!cardColor) {
        return undefined;
      }

      return {
        playerId: player.id,
        playerName: player.name,
        source: 'faceUp' as const,
        cardColor,
        priorCardsDrawnThisTurn: state.cardsDrawnThisTurn,
        priorHand: player.hand,
      };
    }

    return {
      playerId: player.id,
      playerName: player.name,
      source: 'hidden' as const,
      priorCardsDrawnThisTurn: state.cardsDrawnThisTurn,
      priorHand: player.hand,
    };
  }

  private broadcastTrainDrawEvent(
    previousState: GameState,
    nextState: GameState,
    seed?: ReturnType<GameRoom['createTrainDrawEventSeed']>,
  ) {
    if (!seed) {
      return;
    }

    const nextPlayer = nextState.players.find((player) => player.id === seed.playerId);

    if (!nextPlayer) {
      return;
    }

    const cardColor =
      seed.cardColor ?? this.findAddedTrainCard(seed.priorHand, nextPlayer.hand);

    if (!cardColor) {
      return;
    }

    const turnCompleted =
      nextState.currentPlayerId !== previousState.currentPlayerId ||
      nextState.cardsDrawnThisTurn === 0 ||
      nextState.turnAction !== 'drawTrainCards' ||
      cardColor === 'locomotive' && seed.source === 'faceUp';

    const eventId = randomUUID();

    for (const connection of this.connections.values()) {
      const isDrawingPlayer = connection.playerId === seed.playerId;
      const visibleCardColor = seed.source === 'hidden' && !isDrawingPlayer ? undefined : cardColor;
      this.send(connection.socket, {
        type: 'GAME_EVENT',
        event: {
          id: eventId,
          type: 'TRAIN_CARD_DRAWN',
          playerId: seed.playerId,
          playerName: seed.playerName,
          source: seed.source,
          cardColor: visibleCardColor,
          turnCompleted,
          message: this.formatTrainDrawMessage({
            playerName: seed.playerName,
            isDrawingPlayer,
            source: seed.source,
            cardColor: visibleCardColor,
            turnCompleted,
          }),
        },
      });
    }
  }

  private broadcastDeckOnlyFaceUpRefreshEvent(previousState: GameState, nextState: GameState) {
    if (nextState.deckOnlyDrawRefreshCount <= previousState.deckOnlyDrawRefreshCount) {
      return;
    }

    const event: ClientGameEvent = {
      id: randomUUID(),
      type: 'FACE_UP_TRAIN_CARDS_REFRESHED',
      message: 'The face-up train cards were refreshed after repeated deck draws.',
    };

    for (const connection of this.connections.values()) {
      this.send(connection.socket, { type: 'GAME_EVENT', event });
    }
  }

  private broadcastInitialDestinationSelectionStarted() {
    if (!this.state?.pendingDestinationTicketSelection) {
      return;
    }

    this.broadcastDestinationSelectionStarted(this.state.pendingDestinationTicketSelection.playerId, 'setup');
  }

  private broadcastDestinationTicketEvent(
    previousState: GameState,
    nextState: GameState,
    message: ClientMessage,
    previousSelection?: GameState['pendingDestinationTicketSelection'],
  ) {
    if (message.type === 'DRAW_DESTINATION_TICKETS') {
      const selection = nextState.pendingDestinationTicketSelection;

      if (
        selection?.mode === 'turn' &&
        selection.playerId === previousState.currentPlayerId &&
        previousState.pendingDestinationTicketSelection !== selection
      ) {
        this.broadcastDestinationSelectionStarted(selection.playerId, 'turn');
      }

      return;
    }

    if (message.type !== 'KEEP_DESTINATION_TICKETS' || !previousSelection) {
      return;
    }

    const keptCount = previousSelection.tickets.filter((ticket) =>
      message.ticketIds.includes(ticket.id),
    ).length;

    if (keptCount < previousSelection.minKeep) {
      return;
    }

    const nextSetupSelection =
      previousSelection.mode === 'setup' && nextState.pendingDestinationTicketSelection?.mode === 'setup'
        ? nextState.pendingDestinationTicketSelection
        : undefined;

    this.broadcastDestinationSelectionCompleted(previousSelection.playerId, previousSelection.mode, nextSetupSelection?.playerId);
  }

  private broadcastDestinationSelectionStarted(playerId: string, mode: 'setup' | 'turn') {
    const playerName = this.getPlayerName(playerId);
    const eventId = randomUUID();

    for (const connection of this.connections.values()) {
      const isActingPlayer = connection.playerId === playerId;
      this.send(connection.socket, {
        type: 'GAME_EVENT',
        event: {
          id: eventId,
          type: 'DESTINATION_TICKETS',
          playerId,
          playerName,
          mode,
          stage: 'started',
          message:
            mode === 'setup'
              ? isActingPlayer
                ? 'Choose your starting destination tickets.'
                : `${playerName} is choosing starting destination tickets.`
              : isActingPlayer
                ? 'You drew destination tickets. Select at least 1 to keep.'
                : `${playerName} is choosing destination tickets.`,
        },
      });
    }
  }

  private broadcastDestinationSelectionCompleted(
    playerId: string,
    mode: 'setup' | 'turn',
    nextSetupPlayerId?: string,
  ) {
    const playerName = this.getPlayerName(playerId);
    const nextSetupPlayerName = nextSetupPlayerId ? this.getPlayerName(nextSetupPlayerId) : undefined;
    const eventId = randomUUID();

    for (const connection of this.connections.values()) {
      const isActingPlayer = connection.playerId === playerId;
      const isNextSetupPlayer = connection.playerId === nextSetupPlayerId;
      let message: string;

      if (mode === 'setup') {
        if (isActingPlayer) {
          message = 'Starting destination tickets selected.';
        } else if (isNextSetupPlayer) {
          message = 'Choose your starting destination tickets.';
        } else {
          const nextChoosing = nextSetupPlayerName
            ? ` ${nextSetupPlayerName} is choosing starting destination tickets.`
            : '';
          message = `${playerName} finished selecting starting destination tickets.${nextChoosing}`;
        }
      } else if (isActingPlayer) {
        message = 'Destination tickets selected and turn completed.';
      } else {
        message = `${playerName} finished choosing destination tickets.`;
      }

      this.send(connection.socket, {
        type: 'GAME_EVENT',
        event: {
          id: eventId,
          type: 'DESTINATION_TICKETS',
          playerId,
          playerName,
          mode,
          stage: 'completed',
          message,
        },
      });
    }
  }

  private findAddedTrainCard(previousHand: Player['hand'], nextHand: Player['hand']) {
    const cardColors: TrainCardColor[] = [
      'red',
      'blue',
      'green',
      'yellow',
      'black',
      'white',
      'orange',
      'pink',
      'locomotive',
    ];

    return cardColors.find((color) => nextHand[color] > previousHand[color]);
  }

  private formatTrainDrawMessage({
    playerName,
    isDrawingPlayer,
    source,
    cardColor,
    turnCompleted,
  }: {
    playerName: string;
    isDrawingPlayer: boolean;
    source: 'faceUp' | 'hidden';
    cardColor?: TrainCardColor;
    turnCompleted: boolean;
  }) {
    const actor = isDrawingPlayer ? 'You' : playerName;
    const cardDescription = cardColor ? `${this.formatCardColor(cardColor)} card` : 'card';
    const article = cardDescription.toLowerCase().startsWith('orange') ? 'an' : 'a';
    const deckSuffix = source === 'hidden' ? ' from the deck' : '';
    const finished = turnCompleted ? ' and finished drawing' : '';

    return `${actor} drew ${article} ${cardDescription}${deckSuffix}${finished}.`;
  }

  private formatCardColor(color: TrainCardColor) {
    return color[0].toUpperCase() + color.slice(1);
  }

  private getPlayerName(playerId: string) {
    return (
      this.state?.players.find((player) => player.id === playerId)?.name ??
      this.lobbyPlayers.find((player) => player.id === playerId)?.name ??
      'Player'
    );
  }

  private createGameConfigView() {
    return {
      startingTrains: this.gameConfig.startingTrains,
      minStartingTrains: MIN_STARTING_TRAINS,
      maxStartingTrains: this.maxStartingTrains,
      standardStartingTrains: STANDARD_STARTING_TRAINS,
    };
  }
}
