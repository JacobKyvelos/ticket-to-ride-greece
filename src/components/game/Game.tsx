import { useEffect, useMemo, useState } from 'react';
import { Board } from '../board/Board';
import { BottomCardBar } from './BottomCardBar';
import { DestinationTicketSelectionPanel } from './DestinationTicketSelectionPanel';
import { FinalResultsPanel } from './FinalResultsPanel';
import { JoinScreen } from './JoinScreen';
import { Lobby } from './Lobby';
import { PaymentPanel } from './PaymentPanel';
import { PlayerPanel } from './PlayerPanel';
import { ScoreBreakdownModal } from './ScoreBreakdownModal';
import { StationPlacementPanel } from './StationPlacementPanel';
import { StatusToast } from './StatusToast';
import { TunnelAttemptPanel } from './TunnelAttemptPanel';
import { useGameSocket } from '../../client/socket';
import { greeceMap } from '../../data/maps/greece';

type TicketDisplayStatus = 'connected' | 'station' | 'incomplete';

export function Game() {
  const { connectionStatus, view, clientMessage, eventMessage, latestGameEvent, send } = useGameSocket();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [ticketSelectionMinimized, setTicketSelectionMinimized] = useState(false);
  const [selectedPendingTicketIds, setSelectedPendingTicketIds] = useState<string[]>([]);
  const playerColorsById = useMemo(
    () => Object.fromEntries((view?.players ?? []).map((player) => [player.id, player.color])),
    [view?.players],
  );
  const playerNamesById = useMemo(
    () => Object.fromEntries((view?.players ?? []).map((player) => [player.id, player.name])),
    [view?.players],
  );
  const citiesById = useMemo(
    () => new Map(greeceMap.cities.map((city) => [city.id, city])),
    [],
  );
  const getCityName = (cityId: string) => citiesById.get(cityId)?.name ?? cityId;
  const pendingTicketSelectionKey = view?.pendingDestinationTicketSelection
    ? `${view.pendingDestinationTicketSelection.playerId}-${view.pendingDestinationTicketSelection.mode}-${view.pendingDestinationTicketSelection.tickets.map((ticket) => ticket.id).join('|')}`
    : '';

  useEffect(() => {
    if (!view?.pendingDestinationTicketSelection) {
      setTicketSelectionMinimized(false);
      setSelectedPendingTicketIds([]);
      return;
    }

    setTicketSelectionMinimized(false);
    setSelectedPendingTicketIds(view.pendingDestinationTicketSelection.tickets.map((ticket) => ticket.id));
  }, [pendingTicketSelectionKey]);

  if (!view?.connectedPlayerId) {
    return (
      <JoinScreen
        connectionStatus={connectionStatus}
        message={clientMessage}
        onJoin={(name) => send({ type: 'JOIN_GAME', name })}
      />
    );
  }

  if (view.gamePhase === 'lobby') {
    return (
      <Lobby
        players={view.lobbyPlayers}
        isHost={view.isHost}
        gameConfig={view.gameConfig}
        message={clientMessage || view.statusMessage}
        onSetStartingTrains={(value) => send({ type: 'SET_STARTING_TRAINS', value })}
        onSetLongestRouteBonus={(value) => send({ type: 'SET_LONGEST_ROUTE_BONUS', value })}
        onStart={() => send({ type: 'START_GAME' })}
      />
    );
  }

  const viewerPlayer = view.players.find((player) => player.id === view.connectedPlayerId);
  const currentTurnPlayer = view.players.find((player) => player.id === view.currentPlayerId);
  const toastMessage = clientMessage || eventMessage;
  const statusMessage = clientMessage || eventMessage || view.statusMessage;
  const recentlyDrawnCard =
    latestGameEvent?.type === 'TRAIN_CARD_DRAWN' &&
    latestGameEvent.playerId === view.connectedPlayerId &&
    latestGameEvent.cardColor
      ? {
          color: latestGameEvent.cardColor,
          eventId: latestGameEvent.id,
        }
      : undefined;
  const pendingClaimRoute = view.pendingClaim
    ? greeceMap.routes.find((route) => route.id === view.pendingClaim?.routeId)
    : undefined;
  const pendingStationCity = view.pendingStationPlacement?.cityId
    ? citiesById.get(view.pendingStationPlacement.cityId)
    : undefined;
  const scoreBreakdown = viewerPlayer?.scoreBreakdown;
  const activeTicketSummaries =
    scoreBreakdown?.destinations.map((destination) => {
      const status: TicketDisplayStatus = destination.completed
        ? destination.usedStation
          ? 'station'
          : 'connected'
        : 'incomplete';

      return {
        id: destination.ticketId,
        fromName: getCityName(destination.from),
        toName: getCityName(destination.to),
        points: destination.points,
        category: destination.category,
        status,
      };
    }) ?? [];
  const activeDestinationScore =
    scoreBreakdown?.destinationSubtotal ?? 0;
  const activeProjectedTotal =
    view.finalResults?.find((result) => result.playerId === viewerPlayer?.id)?.totalScore ??
    scoreBreakdown?.projectedTotal ??
    (viewerPlayer?.score ?? 0) + activeDestinationScore;
  const canAct =
    view.connectedPlayerId === view.currentPlayerId &&
    (view.gamePhase === 'playing' || view.gamePhase === 'finalRound');
  const canStartAction = canAct && view.turnAction === 'none';
  const pendingTicketSummaries =
    view.pendingDestinationTicketSelection?.tickets.map((ticket) => ({
      id: ticket.id,
      fromName: getCityName(ticket.from),
      toName: getCityName(ticket.to),
      points: ticket.points,
      category: ticket.category,
    })) ?? [];

  return (
    <main className="app">
      <StatusToast message={toastMessage} tone={clientMessage ? 'error' : 'info'} />
      <div className="game-layout" data-sidebar-collapsed={sidebarCollapsed}>
        <div className="sidebar-column">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? '>' : '<'}
          </button>
          <div className="sidebar-content" aria-hidden={sidebarCollapsed}>
            <PlayerPanel
              players={view.players}
              currentPlayerId={view.currentPlayerId ?? ''}
              viewerPlayerId={view.connectedPlayerId}
              statusMessage={statusMessage}
              waitingMessage={
                canAct
                  ? undefined
                  : currentTurnPlayer
                    ? `Waiting for ${currentTurnPlayer.name}...`
                    : undefined
              }
              faceUpTrainCards={view.faceUpTrainCards}
              trainDeckCount={view.trainDeckCount}
              trainDiscardCount={view.trainDiscardCount}
              destinationTicketDeckCount={view.destinationTicketDeckCount}
              cardsDrawnThisTurn={view.cardsDrawnThisTurn}
              activeTicketSummaries={activeTicketSummaries}
              pendingTicketSelection={
                view.pendingDestinationTicketSelection
                  ? {
                      mode: view.pendingDestinationTicketSelection.mode,
                      minKeep: view.pendingDestinationTicketSelection.minKeep,
                      tickets: pendingTicketSummaries,
                      minimized: ticketSelectionMinimized,
                    }
                  : undefined
              }
              activeDestinationScore={activeDestinationScore}
              activeProjectedTotal={activeProjectedTotal}
              canDrawTrainCards={
                canAct &&
                (view.turnAction === 'none' || view.turnAction === 'drawTrainCards')
              }
              canDrawDestinationTickets={
                canStartAction &&
                view.destinationTicketDeckCount > 0
              }
              canPlaceStation={
                canStartAction &&
                Boolean(viewerPlayer && viewerPlayer.stationsRemaining > 0)
              }
              canResetGame={view.isHost}
              gamePhase={view.gamePhase}
              finalTurnsRemaining={view.finalTurnsRemaining}
              recentlyDrawnCard={recentlyDrawnCard}
              onDrawFaceUpCard={(index) => send({ type: 'DRAW_FACE_UP_CARD', index })}
              onDrawDeckCard={() => send({ type: 'DRAW_HIDDEN_CARD' })}
              onDrawDestinationTickets={() => send({ type: 'DRAW_DESTINATION_TICKETS' })}
              onReviewPendingDestinationTickets={() => setTicketSelectionMinimized(false)}
              onBeginPlaceStation={() => send({ type: 'BEGIN_PLACE_STATION' })}
              onOpenScoreBreakdown={() => setScoreBreakdownOpen(true)}
              onResetGame={() => send({ type: 'RESET_GAME' })}
            />
            <PaymentPanel
              route={pendingClaimRoute}
              paymentOptions={view.pendingClaim?.paymentOptions ?? []}
              getCityName={getCityName}
              onChoosePayment={(payment) =>
                pendingClaimRoute &&
                send({ type: 'CHOOSE_ROUTE_PAYMENT', routeId: pendingClaimRoute.id, payment })
              }
              onCancel={() => send({ type: 'CANCEL_ROUTE_CLAIM' })}
            />
            {view.pendingTunnelAttempt && (
              <TunnelAttemptPanel
                attempt={view.pendingTunnelAttempt}
                route={greeceMap.routes.find((route) => route.id === view.pendingTunnelAttempt?.routeId)}
                getCityName={getCityName}
                onPay={() => send({ type: 'RESOLVE_TUNNEL', pay: true })}
                onDecline={() => send({ type: 'RESOLVE_TUNNEL', pay: false })}
              />
            )}
            {view.pendingStationPlacement && (
              <StationPlacementPanel
                cityName={pendingStationCity?.name}
                paymentOptions={view.pendingStationPlacement.paymentOptions}
                onChoosePayment={(payment) =>
                  pendingStationCity &&
                  send({ type: 'CHOOSE_STATION_PAYMENT', cityId: pendingStationCity.id, payment })
                }
                onCancel={() => send({ type: 'CANCEL_STATION_PLACEMENT' })}
              />
            )}
            {view.gamePhase === 'finished' && view.finalResults && (
              <FinalResultsPanel results={view.finalResults} players={view.players} />
            )}
          </div>
        </div>
        <div className="board-column">
          <div className="map-scroll-area">
            <Board
              map={greeceMap}
              debug
              routeOwnership={view.routeOwnership}
              stationOwnership={view.stationOwnership}
              playerColorsById={playerColorsById}
              playerNamesById={playerNamesById}
              stationPlacementActive={canAct && view.turnAction === 'placeStation'}
              onRouteSelect={
                canStartAction
                  ? (route) => send({ type: 'SELECT_ROUTE', routeId: route.id })
                  : undefined
              }
              onCitySelect={
                canAct && view.turnAction === 'placeStation'
                  ? (city) => send({ type: 'SELECT_STATION_CITY', cityId: city.id })
                  : undefined
              }
            />
          </div>
          <BottomCardBar
            viewerPlayer={viewerPlayer}
            faceUpTrainCards={view.faceUpTrainCards}
            trainDeckCount={view.trainDeckCount}
            destinationTicketDeckCount={view.destinationTicketDeckCount}
            cardsDrawnThisTurn={view.cardsDrawnThisTurn}
            canDrawTrainCards={
              canAct && (view.turnAction === 'none' || view.turnAction === 'drawTrainCards')
            }
            canDrawDestinationTickets={canStartAction && view.destinationTicketDeckCount > 0}
            recentlyDrawnCard={recentlyDrawnCard}
            onDrawFaceUpCard={(index) => send({ type: 'DRAW_FACE_UP_CARD', index })}
            onDrawDeckCard={() => send({ type: 'DRAW_HIDDEN_CARD' })}
            onDrawDestinationTickets={() => send({ type: 'DRAW_DESTINATION_TICKETS' })}
          />
        </div>
      </div>
      {view.pendingDestinationTicketSelection && !ticketSelectionMinimized && (
        <DestinationTicketSelectionPanel
          playerName={viewerPlayer?.name ?? 'Player'}
          tickets={view.pendingDestinationTicketSelection.tickets}
          minKeep={view.pendingDestinationTicketSelection.minKeep}
          selectedTicketIds={selectedPendingTicketIds}
          onSelectedTicketIdsChange={setSelectedPendingTicketIds}
          getCityName={getCityName}
          onMinimize={() => setTicketSelectionMinimized(true)}
          onConfirm={(ticketIds) => {
            send({ type: 'KEEP_DESTINATION_TICKETS', ticketIds });
          }}
        />
      )}
      {scoreBreakdownOpen && scoreBreakdown && (
        <ScoreBreakdownModal
          breakdown={scoreBreakdown}
          getCityName={getCityName}
          onClose={() => setScoreBreakdownOpen(false)}
        />
      )}
    </main>
  );
}
