import type { FinalScoreBreakdown } from '../../game/scoring';
import type { ClientPlayerView } from '../../../shared/protocol';

interface FinalResultsPanelProps {
  results: FinalScoreBreakdown[];
  players: ClientPlayerView[];
}

export function FinalResultsPanel({ results, players }: FinalResultsPanelProps) {
  const bestScore = Math.max(...results.map((result) => result.totalScore));
  const winnerNames = results
    .filter((result) => result.totalScore === bestScore)
    .map((result) => players.find((player) => player.id === result.playerId)?.name ?? result.playerId);

  return (
    <section className="payment-panel final-results-panel" aria-label="Final results">
      <div>
        <p className="panel-label">Final results</p>
        <h2>Winner: {winnerNames.join(', ')}</h2>
      </div>

      {results.map((result) => {
        const player = players.find((candidate) => candidate.id === result.playerId);

        return (
          <article key={result.playerId} className="final-result-card">
            <h3>{player?.name ?? result.playerId}</h3>
            <p>Route points: {result.routeScore}</p>
            <p>Completed destinations: +{result.completedDestinationPoints}</p>
            <p>Failed destinations: {result.failedDestinationPoints}</p>
            <p>Unused stations: +{result.stationBonus}</p>
            <p>
              Longest route: {result.longestRouteLength} trains, +{result.longestRouteBonus}
            </p>
            <strong>Final score: {result.totalScore}</strong>
          </article>
        );
      })}
    </section>
  );
}
