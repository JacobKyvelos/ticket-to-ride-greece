import type { Route } from '../types/map';
import type { DestinationTicket, Player, RouteOwnership, StationOwnership } from './gameTypes';

export const ROUTE_SCORE_BY_LENGTH: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 7,
  5: 10,
  6: 15,
  7: 18,
  8: 21,
};

export const UNUSED_STATION_POINTS = 4;
export const DEFAULT_LONGEST_ROUTE_BONUS = 10;

export interface DestinationTicketResult {
  ticket: DestinationTicket;
  connected: boolean;
  usedStation: boolean;
  score: number;
}

export interface FinalScoreBreakdown {
  playerId: string;
  routeScore: number;
  completedDestinationPoints: number;
  failedDestinationPoints: number;
  stationBonus: number;
  longestRouteLength: number;
  longestRouteBonus: number;
  totalScore: number;
}

export interface RouteScoreDetail {
  routeId: string;
  from: string;
  to: string;
  length: number;
  points: number;
}

export interface DestinationScoreDetail {
  ticketId: string;
  from: string;
  to: string;
  points: number;
  category: DestinationTicket['category'];
  completed: boolean;
  usedStation: boolean;
  scoreContribution: number;
}

export interface PlayerScoreBreakdown {
  playerId: string;
  routes: RouteScoreDetail[];
  routeSubtotal: number;
  destinations: DestinationScoreDetail[];
  destinationSubtotal: number;
  stationsRemaining: number;
  stationBonus: number;
  longestRouteLength: number;
  longestRouteBonus: number;
  projectedTotal: number;
}

export function getRouteScore(length: number) {
  return ROUTE_SCORE_BY_LENGTH[length] ?? 0;
}

export function calculateRouteScoreBreakdown(
  playerId: string,
  routeOwnership: RouteOwnership,
  mapRoutes: Route[],
) {
  const routes = mapRoutes
    .filter((route) => routeOwnership[route.id] === playerId)
    .map<RouteScoreDetail>((route) => ({
      routeId: route.id,
      from: route.from,
      to: route.to,
      length: route.length,
      points: getRouteScore(route.length),
    }));

  return {
    routes,
    routeSubtotal: routes.reduce((total, route) => total + route.points, 0),
  };
}

export function isDestinationConnected(
  playerId: string,
  fromCityId: string,
  toCityId: string,
  routeOwnership: RouteOwnership,
  mapRoutes: Route[],
) {
  const graph = createGraph(
    mapRoutes.filter((route) => routeOwnership[route.id] === playerId),
  );

  return canReach(fromCityId, toCityId, graph);
}

export function isDestinationConnectedWithStations(
  playerId: string,
  fromCityId: string,
  toCityId: string,
  routeOwnership: RouteOwnership,
  stationOwnership: StationOwnership,
  mapRoutes: Route[],
) {
  if (isDestinationConnected(playerId, fromCityId, toCityId, routeOwnership, mapRoutes)) {
    return { connected: true, usedStation: false };
  }

  for (const borrowedRouteIds of getBorrowedRouteSets(
    playerId,
    stationOwnership,
    routeOwnership,
    mapRoutes,
  )) {
    if (borrowedRouteIds.length === 0) {
      continue;
    }

    const borrowedRouteIdSet = new Set(borrowedRouteIds);
    const usableRoutes = mapRoutes.filter(
      (route) => routeOwnership[route.id] === playerId || borrowedRouteIdSet.has(route.id),
    );

    if (canReach(fromCityId, toCityId, createGraph(usableRoutes))) {
      return { connected: true, usedStation: true };
    }
  }

  return { connected: false, usedStation: false };
}

export function calculateDestinationTicketBreakdown(
  playerId: string,
  tickets: DestinationTicket[],
  routeOwnership: RouteOwnership,
  stationOwnership: StationOwnership,
  mapRoutes: Route[],
): DestinationTicketResult[] {
  return tickets.map((ticket) => {
    const result = isDestinationConnectedWithStations(
      playerId,
      ticket.from,
      ticket.to,
      routeOwnership,
      stationOwnership,
      mapRoutes,
    );

    return {
      ticket,
      connected: result.connected,
      usedStation: result.usedStation,
      score: result.connected ? ticket.points : -ticket.points,
    };
  });
}

export function calculatePlayerScoreBreakdown(
  player: Player,
  players: Player[],
  routeOwnership: RouteOwnership,
  stationOwnership: StationOwnership,
  mapRoutes: Route[],
  longestRouteBonusValue = DEFAULT_LONGEST_ROUTE_BONUS,
): PlayerScoreBreakdown {
  const routeBreakdown = calculateRouteScoreBreakdown(player.id, routeOwnership, mapRoutes);
  const destinations = calculateDestinationTicketBreakdown(
    player.id,
    player.destinationTickets,
    routeOwnership,
    stationOwnership,
    mapRoutes,
  ).map<DestinationScoreDetail>((result) => ({
    ticketId: result.ticket.id,
    from: result.ticket.from,
    to: result.ticket.to,
    points: result.ticket.points,
    category: result.ticket.category,
    completed: result.connected,
    usedStation: result.usedStation,
    scoreContribution: result.score,
  }));
  const destinationSubtotal = destinations.reduce(
    (total, destination) => total + destination.scoreContribution,
    0,
  );
  const stationBonus = player.stationsRemaining * UNUSED_STATION_POINTS;
  const longestLengths = new Map(
    players.map((candidate) => [
      candidate.id,
      calculateLongestRouteLength(candidate.id, routeOwnership, mapRoutes),
    ]),
  );
  const tableLongestRouteLength = Math.max(0, ...longestLengths.values());
  const longestRouteLength = longestLengths.get(player.id) ?? 0;
  const longestRouteBonus =
    longestRouteLength > 0 && longestRouteLength === tableLongestRouteLength
      ? longestRouteBonusValue
      : 0;
  const projectedTotal =
    routeBreakdown.routeSubtotal + destinationSubtotal + stationBonus + longestRouteBonus;

  return {
    playerId: player.id,
    routes: routeBreakdown.routes,
    routeSubtotal: routeBreakdown.routeSubtotal,
    destinations,
    destinationSubtotal,
    stationsRemaining: player.stationsRemaining,
    stationBonus,
    longestRouteLength,
    longestRouteBonus,
    projectedTotal,
  };
}

export function calculateDestinationTicketScore(
  playerId: string,
  tickets: DestinationTicket[],
  routeOwnership: RouteOwnership,
  stationOwnership: StationOwnership,
  mapRoutes: Route[],
) {
  return calculateDestinationTicketBreakdown(
    playerId,
    tickets,
    routeOwnership,
    stationOwnership,
    mapRoutes,
  ).reduce((total, result) => total + result.score, 0);
}

export function calculateLongestRouteLength(
  playerId: string,
  routeOwnership: RouteOwnership,
  mapRoutes: Route[],
) {
  const ownedRoutes = mapRoutes.filter((route) => routeOwnership[route.id] === playerId);
  const routesByCity = new Map<string, Route[]>();

  for (const route of ownedRoutes) {
    routesByCity.set(route.from, [...(routesByCity.get(route.from) ?? []), route]);
    routesByCity.set(route.to, [...(routesByCity.get(route.to) ?? []), route]);
  }

  function visit(cityId: string, usedRouteIds: Set<string>): number {
    let best = 0;

    for (const route of routesByCity.get(cityId) ?? []) {
      if (usedRouteIds.has(route.id)) {
        continue;
      }

      const nextCityId = route.from === cityId ? route.to : route.from;
      const nextUsedRouteIds = new Set(usedRouteIds);
      nextUsedRouteIds.add(route.id);
      best = Math.max(best, route.length + visit(nextCityId, nextUsedRouteIds));
    }

    return best;
  }

  return [...routesByCity.keys()].reduce(
    (best, cityId) => Math.max(best, visit(cityId, new Set<string>())),
    0,
  );
}

export function calculateFinalScores(
  players: Player[],
  routeOwnership: RouteOwnership,
  stationOwnership: StationOwnership,
  mapRoutes: Route[],
  longestRouteBonusValue = DEFAULT_LONGEST_ROUTE_BONUS,
): FinalScoreBreakdown[] {
  const longestLengths = new Map(
    players.map((player) => [
      player.id,
      calculateLongestRouteLength(player.id, routeOwnership, mapRoutes),
    ]),
  );
  const tableLongestRouteLength = Math.max(0, ...longestLengths.values());

  return players.map((player) => {
    const scoreBreakdown = calculatePlayerScoreBreakdown(
      player,
      players,
      routeOwnership,
      stationOwnership,
      mapRoutes,
      longestRouteBonusValue,
    );
    const completedDestinationPoints = scoreBreakdown.destinations
      .filter((result) => result.completed)
      .reduce((total, result) => total + result.points, 0);
    const failedDestinationPoints = scoreBreakdown.destinations
      .filter((result) => !result.completed)
      .reduce((total, result) => total - result.points, 0);
    const stationBonus = player.stationsRemaining * UNUSED_STATION_POINTS;
    const longestRouteLength = longestLengths.get(player.id) ?? 0;
    const longestRouteBonus =
      longestRouteLength > 0 && longestRouteLength === tableLongestRouteLength
        ? longestRouteBonusValue
        : 0;
    const totalScore =
      player.score +
      completedDestinationPoints +
      failedDestinationPoints +
      stationBonus +
      longestRouteBonus;

    return {
      playerId: player.id,
      routeScore: player.score,
      completedDestinationPoints,
      failedDestinationPoints,
      stationBonus,
      longestRouteLength,
      longestRouteBonus,
      totalScore,
    };
  });
}

function createGraph(routes: Route[]) {
  const graph = new Map<string, string[]>();

  for (const route of routes) {
    graph.set(route.from, [...(graph.get(route.from) ?? []), route.to]);
    graph.set(route.to, [...(graph.get(route.to) ?? []), route.from]);
  }

  return graph;
}

function canReach(fromCityId: string, toCityId: string, graph: Map<string, string[]>) {
  const visited = new Set<string>();
  const queue = [fromCityId];

  while (queue.length > 0) {
    const cityId = queue.shift();

    if (!cityId || visited.has(cityId)) {
      continue;
    }

    if (cityId === toCityId) {
      return true;
    }

    visited.add(cityId);
    queue.push(...(graph.get(cityId) ?? []));
  }

  return false;
}

function getBorrowedRouteSets(
  playerId: string,
  stationOwnership: StationOwnership,
  routeOwnership: RouteOwnership,
  mapRoutes: Route[],
) {
  const optionsByStation = Object.entries(stationOwnership)
    .filter(([, ownerId]) => ownerId === playerId)
    .map(([cityId]) => [
      undefined,
      ...mapRoutes
        .filter(
          (route) =>
            routeOwnership[route.id] &&
            routeOwnership[route.id] !== playerId &&
            (route.from === cityId || route.to === cityId),
        )
        .map((route) => route.id),
    ]);

  return optionsByStation.reduce<string[][]>(
    (sets, routeOptions) =>
      sets.flatMap((set) =>
        routeOptions.map((routeId) => (routeId ? [...set, routeId] : [...set])),
      ),
    [[]],
  );
}
