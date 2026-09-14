import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { greeceMapData } from '../src/data/maps/greeceStatic';
import {
  greeceDestinationTickets,
  greeceLongDestinationTickets,
  greeceRegularDestinationTickets,
} from '../src/data/tickets/greeceTickets';
import type { DestinationTicket } from '../src/game/gameTypes';
import type { Route } from '../src/types/map';

interface CandidatePair {
  fromName: string;
  toName: string;
}

interface GraphEdge {
  routeId: string;
  to: string;
  length: number;
}

interface PathResult {
  cost: number;
  edgeCount: number;
  nodes: string[];
  edgeIds: string[];
}

interface CandidateAnalysis {
  from: string;
  to: string;
  fromId: string;
  toId: string;
  shortestTrainCost: number | null;
  shortestEdgeCount: number | null;
  equalShortestPathCount: number;
  secondBestTrainCost: number | null;
  detourPenalty: number | null;
  suggestedTicketPoints: number | null;
  classification: 'SHORT' | 'MEDIUM' | 'LONG' | 'REJECT_DIRECT' | 'DISCONNECTED';
}

interface FinalTicketAnalysis {
  category: DestinationTicket['category'];
  from: string;
  to: string;
  fromId: string;
  toId: string;
  points: number;
  shortestTrainCost: number;
  shortestEdgeCount: number;
  equalShortestPathCount: number;
}

const candidatePairs: CandidatePair[] = [
  { fromName: 'Florina', toName: 'Thessaloniki' },
  { fromName: 'Florina', toName: 'Ioannina' },
  { fromName: 'Ptolemaida', toName: 'Volos' },
  { fromName: 'Serres', toName: 'Mount Athos' },
  { fromName: 'Drama', toName: 'Orestiada' },
  { fromName: 'Thessaloniki', toName: 'Volos' },
  { fromName: 'Ioannina', toName: 'Patras' },
  { fromName: 'Ioannina', toName: 'Lamia' },
  { fromName: 'Trikala', toName: 'Athens' },
  { fromName: 'Larissa', toName: 'Chalkida' },
  { fromName: 'Volos', toName: 'Athens' },
  { fromName: 'Agrinio', toName: 'Corinth' },
  { fromName: 'Patras', toName: 'Kalamata' },
  { fromName: 'Corinth', toName: 'Monemvasia' },
  { fromName: 'Pyrgos', toName: 'Monemvasia' },
  { fromName: 'Athens', toName: 'Naxos' },
  { fromName: 'Florina', toName: 'Lamia' },
  { fromName: 'Florina', toName: 'Agrinio' },
  { fromName: 'Ptolemaida', toName: 'Athens' },
  { fromName: 'Serres', toName: 'Ioannina' },
  { fromName: 'Drama', toName: 'Thessaloniki' },
  { fromName: 'Orestiada', toName: 'Thessaloniki' },
  { fromName: 'Mount Athos', toName: 'Samos' },
  { fromName: 'Ioannina', toName: 'Athens' },
  { fromName: 'Trikala', toName: 'Chios' },
  { fromName: 'Larissa', toName: 'Mytilene' },
  { fromName: 'Volos', toName: 'Samos' },
  { fromName: 'Agrinio', toName: 'Thessaloniki' },
  { fromName: 'Patras', toName: 'Athens' },
  { fromName: 'Patras', toName: 'Naxos' },
  { fromName: 'Kalamata', toName: 'Athens' },
  { fromName: 'Monemvasia', toName: 'Naxos' },
  { fromName: 'Athens', toName: 'Chios' },
  { fromName: 'Athens', toName: 'Heraklion' },
  { fromName: 'Florina', toName: 'Athens' },
  { fromName: 'Florina', toName: 'Mytilene' },
  { fromName: 'Orestiada', toName: 'Athens' },
  { fromName: 'Orestiada', toName: 'Ioannina' },
  { fromName: 'Thessaloniki', toName: 'Patras' },
  { fromName: 'Thessaloniki', toName: 'Naxos' },
  { fromName: 'Ioannina', toName: 'Chios' },
  { fromName: 'Corfu', toName: 'Athens' },
  { fromName: 'Corfu', toName: 'Kalamata' },
  { fromName: 'Patras', toName: 'Mytilene' },
  { fromName: 'Kalamata', toName: 'Mytilene' },
  { fromName: 'Samos', toName: 'Heraklion' },
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../analysis/destination-ticket-analysis.json');

function routePairKey(from: string, to: string) {
  return [from, to].sort().join('__');
}

function validateRouteGraph(routes: Route[], cityIds: Set<string>) {
  const errors: string[] = [];
  const routeIds = new Set<string>();
  const routePairs = new Map<string, string>();

  for (const route of routes) {
    if (routeIds.has(route.id)) {
      errors.push(`Duplicate route ID: ${route.id}`);
    }
    routeIds.add(route.id);

    if (!cityIds.has(route.from)) {
      errors.push(`Route ${route.id} references missing city: ${route.from}`);
    }

    if (!cityIds.has(route.to)) {
      errors.push(`Route ${route.id} references missing city: ${route.to}`);
    }

    if (!Number.isFinite(route.length) || route.length <= 0) {
      errors.push(`Route ${route.id} has non-positive length: ${route.length}`);
    }

    const pairKey = routePairKey(route.from, route.to);
    const existingRouteId = routePairs.get(pairKey);
    if (existingRouteId) {
      errors.push(`Duplicate undirected route pair: ${existingRouteId} and ${route.id}`);
    }
    routePairs.set(pairKey, route.id);
  }

  return errors;
}

function resolveCandidateIds(candidates: CandidatePair[]) {
  const nameToId = new Map(greeceMapData.cities.map((city) => [city.name.toLowerCase(), city.id]));
  const errors: string[] = [];

  const resolved = candidates.map((candidate) => {
    const fromId = nameToId.get(candidate.fromName.toLowerCase());
    const toId = nameToId.get(candidate.toName.toLowerCase());

    if (!fromId || !toId) {
      errors.push(
        `${candidate.fromName} - ${candidate.toName}: ${
          !fromId ? `missing "${candidate.fromName}"` : ''
        }${!fromId && !toId ? ', ' : ''}${!toId ? `missing "${candidate.toName}"` : ''}`,
      );
    }

    return {
      ...candidate,
      fromId: fromId ?? '',
      toId: toId ?? '',
    };
  });

  return { resolved, errors };
}

function buildGraph(routes: Route[]) {
  const graph = new Map<string, GraphEdge[]>();

  for (const city of greeceMapData.cities) {
    graph.set(city.id, []);
  }

  for (const route of routes) {
    graph.get(route.from)?.push({ routeId: route.id, to: route.to, length: route.length });
    graph.get(route.to)?.push({ routeId: route.id, to: route.from, length: route.length });
  }

  for (const edges of graph.values()) {
    edges.sort((a, b) => a.length - b.length || a.to.localeCompare(b.to) || a.routeId.localeCompare(b.routeId));
  }

  return graph;
}

function dijkstraPath(
  graph: Map<string, GraphEdge[]>,
  from: string,
  to: string,
  bannedNodes = new Set<string>(),
  bannedEdges = new Set<string>(),
): PathResult | undefined {
  if (bannedNodes.has(from) || bannedNodes.has(to)) {
    return undefined;
  }

  const distances = new Map<string, number>([[from, 0]]);
  const edgeCounts = new Map<string, number>([[from, 0]]);
  const previous = new Map<string, { cityId: string; routeId: string }>();
  const unsettled = new Set<string>([from]);

  while (unsettled.size > 0) {
    const current = [...unsettled].sort(
      (a, b) =>
        (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity) ||
        (edgeCounts.get(a) ?? Infinity) - (edgeCounts.get(b) ?? Infinity) ||
        a.localeCompare(b),
    )[0];

    unsettled.delete(current);

    if (current === to) {
      break;
    }

    for (const edge of graph.get(current) ?? []) {
      if (bannedNodes.has(edge.to) || bannedEdges.has(edge.routeId)) {
        continue;
      }

      const nextDistance = (distances.get(current) ?? Infinity) + edge.length;
      const nextEdgeCount = (edgeCounts.get(current) ?? Infinity) + 1;
      const existingDistance = distances.get(edge.to) ?? Infinity;
      const existingEdgeCount = edgeCounts.get(edge.to) ?? Infinity;

      if (
        nextDistance < existingDistance ||
        (nextDistance === existingDistance && nextEdgeCount < existingEdgeCount)
      ) {
        distances.set(edge.to, nextDistance);
        edgeCounts.set(edge.to, nextEdgeCount);
        previous.set(edge.to, { cityId: current, routeId: edge.routeId });
        unsettled.add(edge.to);
      }
    }
  }

  const cost = distances.get(to);
  if (cost === undefined) {
    return undefined;
  }

  const nodes = [to];
  const edgeIds: string[] = [];
  let cursor = to;

  while (cursor !== from) {
    const step = previous.get(cursor);
    if (!step) {
      return undefined;
    }

    edgeIds.unshift(step.routeId);
    nodes.unshift(step.cityId);
    cursor = step.cityId;
  }

  return {
    cost,
    edgeCount: edgeIds.length,
    nodes,
    edgeIds,
  };
}

function calculateDistances(graph: Map<string, GraphEdge[]>, from: string) {
  const distances = new Map<string, number>([[from, 0]]);
  const unsettled = new Set<string>([from]);

  while (unsettled.size > 0) {
    const current = [...unsettled].sort(
      (a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity) || a.localeCompare(b),
    )[0];

    unsettled.delete(current);

    for (const edge of graph.get(current) ?? []) {
      const nextDistance = (distances.get(current) ?? Infinity) + edge.length;
      if (nextDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDistance);
        unsettled.add(edge.to);
      }
    }
  }

  return distances;
}

function countEqualShortestPaths(graph: Map<string, GraphEdge[]>, from: string, to: string, shortestCost: number) {
  const distances = calculateDistances(graph, from);
  const counts = new Map<string, number>([[from, 1]]);
  const citiesByDistance = [...distances.entries()]
    .filter(([, distance]) => distance <= shortestCost)
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

  for (const [cityId, distance] of citiesByDistance) {
    const cityCount = counts.get(cityId) ?? 0;
    if (cityCount === 0) {
      continue;
    }

    for (const edge of graph.get(cityId) ?? []) {
      const nextDistance = distances.get(edge.to);
      if (nextDistance === undefined || nextDistance > shortestCost) {
        continue;
      }

      if (distance + edge.length === nextDistance) {
        counts.set(edge.to, (counts.get(edge.to) ?? 0) + cityCount);
      }
    }
  }

  return counts.get(to) ?? 0;
}

function pathKey(path: PathResult) {
  return path.edgeIds.join('>');
}

function getRootCost(path: PathResult, edgeCount: number, routeLengthsById: Map<string, number>) {
  return path.edgeIds.slice(0, edgeCount).reduce((sum, routeId) => sum + (routeLengthsById.get(routeId) ?? 0), 0);
}

function findSecondBestTrainCost(
  graph: Map<string, GraphEdge[]>,
  routeLengthsById: Map<string, number>,
  from: string,
  to: string,
  shortest: PathResult,
) {
  const acceptedPaths: PathResult[] = [shortest];
  const candidates = new Map<string, PathResult>();
  const maxAcceptedPaths = 80;

  for (let iteration = 0; iteration < maxAcceptedPaths; iteration += 1) {
    const basePath = acceptedPaths[acceptedPaths.length - 1];

    for (let spurIndex = 0; spurIndex < basePath.nodes.length - 1; spurIndex += 1) {
      const rootNodes = basePath.nodes.slice(0, spurIndex + 1);
      const rootEdgeIds = basePath.edgeIds.slice(0, spurIndex);
      const bannedEdges = new Set<string>();
      const bannedNodes = new Set(rootNodes.slice(0, -1));

      for (const path of acceptedPaths) {
        const sameRoot = rootNodes.every((cityId, index) => path.nodes[index] === cityId);
        if (sameRoot && path.edgeIds[spurIndex]) {
          bannedEdges.add(path.edgeIds[spurIndex]);
        }
      }

      const spurPath = dijkstraPath(graph, rootNodes[rootNodes.length - 1], to, bannedNodes, bannedEdges);
      if (!spurPath) {
        continue;
      }

      const totalPath: PathResult = {
        cost: getRootCost(basePath, spurIndex, routeLengthsById) + spurPath.cost,
        edgeCount: rootEdgeIds.length + spurPath.edgeCount,
        nodes: [...rootNodes.slice(0, -1), ...spurPath.nodes],
        edgeIds: [...rootEdgeIds, ...spurPath.edgeIds],
      };

      if (new Set(totalPath.nodes).size !== totalPath.nodes.length) {
        continue;
      }

      candidates.set(pathKey(totalPath), totalPath);
    }

    const nextPath = [...candidates.values()].sort(
      (a, b) => a.cost - b.cost || a.edgeCount - b.edgeCount || pathKey(a).localeCompare(pathKey(b)),
    )[0];

    if (!nextPath) {
      return null;
    }

    candidates.delete(pathKey(nextPath));
    acceptedPaths.push(nextPath);

    if (nextPath.cost > shortest.cost) {
      return nextPath.cost;
    }
  }

  return null;
}

function classifyByDistribution(
  cost: number | null,
  edgeCount: number | null,
  shortCutoff: number,
  mediumCutoff: number,
): CandidateAnalysis['classification'] {
  if (cost === null || edgeCount === null) {
    return 'DISCONNECTED';
  }

  if (edgeCount < 2) {
    return 'REJECT_DIRECT';
  }

  if (cost <= shortCutoff) {
    return 'SHORT';
  }

  if (cost <= mediumCutoff) {
    return 'MEDIUM';
  }

  return 'LONG';
}

function percentile(sortedValues: number[], ratio: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  return sortedValues[Math.floor((sortedValues.length - 1) * ratio)];
}

function pad(value: string | number | null, width: number) {
  return String(value ?? '-').padEnd(width, ' ');
}

function printTable(analyses: CandidateAnalysis[]) {
  const rows = analyses.map((analysis) => ({
    ticket: `${analysis.from} - ${analysis.to}`,
    cost: analysis.shortestTrainCost,
    edges: analysis.shortestEdgeCount,
    equal: analysis.equalShortestPathCount,
    points: analysis.suggestedTicketPoints,
    classification: analysis.classification,
  }));
  const widths = {
    ticket: Math.max('Ticket'.length, ...rows.map((row) => row.ticket.length)),
    cost: 'Shortest Cost'.length,
    edges: 'Edges'.length,
    equal: 'Equal Shortest Paths'.length,
    points: 'Suggested Points'.length,
    classification: 'Classification'.length,
  };

  console.log(
    [
      pad('Ticket', widths.ticket),
      pad('Shortest Cost', widths.cost),
      pad('Edges', widths.edges),
      pad('Equal Shortest Paths', widths.equal),
      pad('Suggested Points', widths.points),
      pad('Classification', widths.classification),
    ].join('  '),
  );
  console.log(
    [
      '-'.repeat(widths.ticket),
      '-'.repeat(widths.cost),
      '-'.repeat(widths.edges),
      '-'.repeat(widths.equal),
      '-'.repeat(widths.points),
      '-'.repeat(widths.classification),
    ].join('  '),
  );

  for (const row of rows) {
    console.log(
      [
        pad(row.ticket, widths.ticket),
        pad(row.cost, widths.cost),
        pad(row.edges, widths.edges),
        pad(row.equal, widths.equal),
        pad(row.points, widths.points),
        pad(row.classification, widths.classification),
      ].join('  '),
    );
  }
}

function printDistributionSummary(analyses: CandidateAnalysis[]) {
  const valid = analyses.filter((analysis) => analysis.shortestTrainCost !== null);
  const validForTickets = analyses.filter(
    (analysis) => analysis.shortestTrainCost !== null && analysis.classification !== 'REJECT_DIRECT',
  );
  const costs = validForTickets
    .map((analysis) => analysis.shortestTrainCost)
    .filter((cost): cost is number => cost !== null)
    .sort((a, b) => a - b);
  const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  const median =
    costs.length % 2 === 0
      ? (costs[costs.length / 2 - 1] + costs[costs.length / 2]) / 2
      : costs[Math.floor(costs.length / 2)];
  const min = costs[0];
  const max = costs[costs.length - 1];
  const binStart = Math.floor(min / 3) * 3;
  const bins = Array.from({ length: Math.ceil((max - binStart + 1) / 3) }, (_, index) => {
    const start = binStart + index * 3;
    const end = start + 2;
    return {
      label: `${start}-${end}`,
      count: costs.filter((cost) => cost >= start && cost <= end).length,
    };
  });

  console.log('\nSUMMARY');
  console.log(`Total candidates: ${analyses.length}`);
  console.log(`Valid candidates: ${validForTickets.length}`);
  console.log(`Rejected direct: ${analyses.filter((analysis) => analysis.classification === 'REJECT_DIRECT').length}`);
  console.log(`Disconnected: ${analyses.filter((analysis) => analysis.classification === 'DISCONNECTED').length}`);
  console.log(`Min shortest cost: ${min}`);
  console.log(`Median shortest cost: ${median.toFixed(1)}`);
  console.log(`Mean shortest cost: ${mean.toFixed(1)}`);
  console.log(`Max shortest cost: ${max}`);
  console.log('\nCost distribution:');
  for (const bin of bins) {
    console.log(`${bin.label}: ${bin.count}`);
  }
}

function formatStats(label: string, values: number[]) {
  const sortedValues = [...values].sort((a, b) => a - b);
  const mean = sortedValues.reduce((sum, value) => sum + value, 0) / sortedValues.length;
  const median =
    sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)];

  console.log(`\n${label}`);
  console.log(`count: ${sortedValues.length}`);
  console.log(`min: ${sortedValues[0]}`);
  console.log(`median: ${median.toFixed(1)}`);
  console.log(`mean: ${mean.toFixed(1)}`);
  console.log(`max: ${sortedValues[sortedValues.length - 1]}`);
}

function printPointBuckets(label: string, values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binStart = Math.floor(min / 3) * 3;
  const bins = Array.from({ length: Math.ceil((max - binStart + 1) / 3) }, (_, index) => {
    const start = binStart + index * 3;
    const end = start + 2;
    return {
      label: `${start}-${end}`,
      count: values.filter((value) => value >= start && value <= end).length,
    };
  });

  console.log(`\n${label} point buckets:`);
  for (const bin of bins) {
    console.log(`${bin.label}: ${bin.count}`);
  }
}

function printFinalDeckTable(analyses: FinalTicketAnalysis[]) {
  const rows = analyses.map((analysis) => ({
    category: analysis.category.toUpperCase(),
    ticket: `${analysis.from} - ${analysis.to}`,
    points: analysis.points,
    cost: analysis.shortestTrainCost,
    edges: analysis.shortestEdgeCount,
    equal: analysis.equalShortestPathCount,
  }));
  const widths = {
    category: 'Category'.length,
    ticket: Math.max('Ticket'.length, ...rows.map((row) => row.ticket.length)),
    points: 'Points'.length,
    cost: 'Shortest Cost'.length,
    edges: 'Edges'.length,
    equal: 'Equal Shortest Paths'.length,
  };

  console.log('\nFINAL LIVE DESTINATION TICKET DECK');
  console.log(
    [
      pad('Category', widths.category),
      pad('Ticket', widths.ticket),
      pad('Points', widths.points),
      pad('Shortest Cost', widths.cost),
      pad('Edges', widths.edges),
      pad('Equal Shortest Paths', widths.equal),
    ].join('  '),
  );
  console.log(
    [
      '-'.repeat(widths.category),
      '-'.repeat(widths.ticket),
      '-'.repeat(widths.points),
      '-'.repeat(widths.cost),
      '-'.repeat(widths.edges),
      '-'.repeat(widths.equal),
    ].join('  '),
  );

  for (const row of rows) {
    console.log(
      [
        pad(row.category, widths.category),
        pad(row.ticket, widths.ticket),
        pad(row.points, widths.points),
        pad(row.cost, widths.cost),
        pad(row.edges, widths.edges),
        pad(row.equal, widths.equal),
      ].join('  '),
    );
  }
}

function validateAndAnalyzeFinalDeck(
  graph: Map<string, GraphEdge[]>,
  cityIds: Set<string>,
): FinalTicketAnalysis[] {
  const errors: string[] = [];
  const ticketIds = new Set<string>();
  const ticketPairs = new Set<string>();

  if (greeceRegularDestinationTickets.length !== 40) {
    errors.push(`Expected 40 regular tickets, found ${greeceRegularDestinationTickets.length}.`);
  }

  if (greeceLongDestinationTickets.length !== 6) {
    errors.push(`Expected 6 long tickets, found ${greeceLongDestinationTickets.length}.`);
  }

  if (greeceDestinationTickets.length !== 46) {
    errors.push(`Expected 46 total tickets, found ${greeceDestinationTickets.length}.`);
  }

  const analyses = greeceDestinationTickets.map<FinalTicketAnalysis | undefined>((ticket) => {
    if (ticketIds.has(ticket.id)) {
      errors.push(`Duplicate ticket ID: ${ticket.id}`);
    }
    ticketIds.add(ticket.id);

    const pairKey = routePairKey(ticket.from, ticket.to);
    if (ticketPairs.has(pairKey)) {
      errors.push(`Duplicate/reversed ticket pair: ${ticket.from} - ${ticket.to}`);
    }
    ticketPairs.add(pairKey);

    if (!cityIds.has(ticket.from)) {
      errors.push(`Ticket ${ticket.id} references missing city: ${ticket.from}`);
    }

    if (!cityIds.has(ticket.to)) {
      errors.push(`Ticket ${ticket.id} references missing city: ${ticket.to}`);
    }

    const shortestPath = dijkstraPath(graph, ticket.from, ticket.to);
    if (!shortestPath) {
      errors.push(`Ticket ${ticket.id} is disconnected.`);
      return undefined;
    }

    if (shortestPath.edgeCount < 2) {
      errors.push(`Ticket ${ticket.id} uses fewer than 2 route edges.`);
    }

    if (ticket.points !== shortestPath.cost) {
      errors.push(`Ticket ${ticket.id} has ${ticket.points} points but shortestTrainCost is ${shortestPath.cost}.`);
    }

    return {
      category: ticket.category,
      from: greeceMapData.cities.find((city) => city.id === ticket.from)?.name ?? ticket.from,
      to: greeceMapData.cities.find((city) => city.id === ticket.to)?.name ?? ticket.to,
      fromId: ticket.from,
      toId: ticket.to,
      points: ticket.points,
      shortestTrainCost: shortestPath.cost,
      shortestEdgeCount: shortestPath.edgeCount,
      equalShortestPathCount: countEqualShortestPaths(graph, ticket.from, ticket.to, shortestPath.cost),
    };
  });

  const resolvedAnalyses = analyses.filter((analysis): analysis is FinalTicketAnalysis => Boolean(analysis));

  if (errors.length > 0) {
    console.error('Final live ticket deck validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }

  return resolvedAnalyses.sort(
    (a, b) =>
      (a.category === b.category ? 0 : a.category === 'regular' ? -1 : 1) ||
      a.points - b.points ||
      a.from.localeCompare(b.from) ||
      a.to.localeCompare(b.to),
  );
}

function printEndpointFrequency(analyses: FinalTicketAnalysis[]) {
  const frequencies = new Map<string, number>();
  const namesById = new Map(greeceMapData.cities.map((city) => [city.id, city.name]));

  for (const ticket of analyses) {
    frequencies.set(ticket.fromId, (frequencies.get(ticket.fromId) ?? 0) + 1);
    frequencies.set(ticket.toId, (frequencies.get(ticket.toId) ?? 0) + 1);
  }

  const rows = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || namesById.get(a[0])!.localeCompare(namesById.get(b[0])!));
  const neverUsedCities = greeceMapData.cities.filter((city) => !frequencies.has(city.id));
  const leastUsedCount = Math.min(...rows.map(([, count]) => count));

  console.log('\nENDPOINT FREQUENCY');
  for (const [cityId, count] of rows) {
    console.log(`${pad(namesById.get(cityId) ?? cityId, 16)} ${count}`);
  }

  console.log(`\nMost-used endpoint: ${namesById.get(rows[0][0])} (${rows[0][1]})`);
  console.log(`Least-used represented endpoint count: ${leastUsedCount}`);
  console.log(`Playable cities represented: ${rows.length}`);
  console.log(`Playable cities never used on a ticket: ${neverUsedCities.length}`);
  if (neverUsedCities.length > 0) {
    console.log(`Never used: ${neverUsedCities.map((city) => city.name).join(', ')}`);
  }
}

function main() {
  const cityIds = new Set(greeceMapData.cities.map((city) => city.id));
  const graphErrors = validateRouteGraph(greeceMapData.routes, cityIds);
  const { resolved, errors: candidateErrors } = resolveCandidateIds(candidatePairs);
  const validationErrors = [...graphErrors, ...candidateErrors];

  if (validationErrors.length > 0) {
    console.error('Ticket analysis validation failed:');
    for (const error of validationErrors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  const graph = buildGraph(greeceMapData.routes);
  const routeLengthsById = new Map(greeceMapData.routes.map((route) => [route.id, route.length]));
  const finalDeckAnalyses = validateAndAnalyzeFinalDeck(graph, cityIds);

  if (process.exitCode) {
    return;
  }

  console.log('FINAL LIVE DECK VALIDATION');
  console.log(`Regular tickets: ${greeceRegularDestinationTickets.length}`);
  console.log(`Long tickets: ${greeceLongDestinationTickets.length}`);
  console.log(`Total: ${greeceDestinationTickets.length}`);
  printFinalDeckTable(finalDeckAnalyses);
  formatStats(
    'REGULAR TICKETS',
    finalDeckAnalyses.filter((analysis) => analysis.category === 'regular').map((analysis) => analysis.points),
  );
  formatStats(
    'LONG TICKETS',
    finalDeckAnalyses.filter((analysis) => analysis.category === 'long').map((analysis) => analysis.points),
  );
  printPointBuckets(
    'Regular',
    finalDeckAnalyses.filter((analysis) => analysis.category === 'regular').map((analysis) => analysis.points),
  );
  printPointBuckets(
    'Long',
    finalDeckAnalyses.filter((analysis) => analysis.category === 'long').map((analysis) => analysis.points),
  );
  printEndpointFrequency(finalDeckAnalyses);

  const preliminary = resolved.map((candidate) => {
    const shortestPath = dijkstraPath(graph, candidate.fromId, candidate.toId);
    const secondBestTrainCost = shortestPath
      ? findSecondBestTrainCost(graph, routeLengthsById, candidate.fromId, candidate.toId, shortestPath)
      : null;

    return {
      candidate,
      shortestPath,
      secondBestTrainCost,
    };
  });
  const validCosts = preliminary
    .filter((entry) => entry.shortestPath && entry.shortestPath.edgeCount >= 2)
    .map((entry) => entry.shortestPath?.cost ?? 0)
    .sort((a, b) => a - b);
  const shortCutoff = percentile(validCosts, 1 / 3);
  const mediumCutoff = percentile(validCosts, 2 / 3);
  const analyses = preliminary
    .map<CandidateAnalysis>((entry) => {
      const shortestTrainCost = entry.shortestPath?.cost ?? null;
      const shortestEdgeCount = entry.shortestPath?.edgeCount ?? null;

      return {
        from: entry.candidate.fromName,
        to: entry.candidate.toName,
        fromId: entry.candidate.fromId,
        toId: entry.candidate.toId,
        shortestTrainCost,
        shortestEdgeCount,
        equalShortestPathCount: entry.shortestPath
          ? countEqualShortestPaths(graph, entry.candidate.fromId, entry.candidate.toId, entry.shortestPath.cost)
          : 0,
        secondBestTrainCost: entry.secondBestTrainCost,
        detourPenalty:
          shortestTrainCost !== null && entry.secondBestTrainCost !== null
            ? entry.secondBestTrainCost - shortestTrainCost
            : null,
        suggestedTicketPoints: shortestTrainCost,
        classification: classifyByDistribution(shortestTrainCost, shortestEdgeCount, shortCutoff, mediumCutoff),
      };
    })
    .sort(
      (a, b) =>
        (a.shortestTrainCost ?? Infinity) - (b.shortestTrainCost ?? Infinity) ||
        a.from.localeCompare(b.from) ||
        a.to.localeCompare(b.to),
    );

  console.log('DESTINATION TICKET CANDIDATE ANALYSIS');
  console.log(`Classification thresholds from valid candidate tertiles: SHORT <= ${shortCutoff}, MEDIUM <= ${mediumCutoff}, LONG > ${mediumCutoff}`);
  console.log(`Suggested Ticket Points = shortestTrainCost\n`);
  printTable(analyses);

  const topLongCandidates = analyses
    .filter((analysis) => analysis.classification !== 'REJECT_DIRECT' && analysis.classification !== 'DISCONNECTED')
    .sort(
      (a, b) =>
        (b.shortestTrainCost ?? 0) - (a.shortestTrainCost ?? 0) ||
        (b.shortestEdgeCount ?? 0) - (a.shortestEdgeCount ?? 0) ||
        b.equalShortestPathCount - a.equalShortestPathCount,
    )
    .slice(0, 6);

  console.log('\nTOP 6 LONG-TICKET CANDIDATES');
  for (const candidate of topLongCandidates) {
    console.log(
      `${candidate.from} - ${candidate.to}: cost ${candidate.shortestTrainCost}, edges ${candidate.shortestEdgeCount}, equal shortest paths ${candidate.equalShortestPathCount}`,
    );
  }

  printDistributionSummary(analyses);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedFrom: 'src/data/maps/greeceStatic.ts',
        candidateCount: analyses.length,
        classificationThresholds: {
          shortMax: shortCutoff,
          mediumMax: mediumCutoff,
        },
        finalDeck: finalDeckAnalyses,
        candidates: analyses,
        topLongCandidates,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nWrote ${outputPath}`);
}

main();
