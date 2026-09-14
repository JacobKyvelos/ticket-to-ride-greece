import type { PlayerScoreBreakdown } from '../../game/scoring';
import { useEffect } from 'react';

interface ScoreBreakdownModalProps {
  breakdown: PlayerScoreBreakdown;
  getCityName: (cityId: string) => string;
  onClose: () => void;
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function ScoreBreakdownModal({
  breakdown,
  getCityName,
  onClose,
}: ScoreBreakdownModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="ticket-modal-backdrop score-breakdown-backdrop" role="presentation">
      <section
        className="ticket-selection-modal score-breakdown-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-breakdown-title"
      >
        <div className="score-breakdown-modal__header">
          <div>
            <p className="panel-label">Final score preview</p>
            <h2 id="score-breakdown-title">Score Breakdown</h2>
          </div>
          <button type="button" aria-label="Close score breakdown" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="score-breakdown-modal__content">
          <section className="score-breakdown-section">
            <h3>Routes</h3>
            {breakdown.routes.length > 0 ? (
              breakdown.routes.map((route) => (
                <article key={route.routeId} className="score-breakdown-row">
                  <span>
                    {getCityName(route.from)} to {getCityName(route.to)}
                  </span>
                  <small>Length {route.length}</small>
                  <strong>+{route.points}</strong>
                </article>
              ))
            ) : (
              <p className="empty-note">No claimed routes yet.</p>
            )}
            <p className="score-breakdown-subtotal">Route subtotal: {breakdown.routeSubtotal}</p>
          </section>

          <section className="score-breakdown-section">
            <h3>Destinations</h3>
            {breakdown.destinations.length > 0 ? (
              breakdown.destinations.map((destination) => (
                <article
                  key={destination.ticketId}
                  className="score-breakdown-row"
                  data-status={destination.completed ? 'connected' : 'incomplete'}
                >
                  <span>
                    {getCityName(destination.from)} to {getCityName(destination.to)}
                  </span>
                  <small>
                    {destination.category === 'long' ? 'LONG | ' : ''}
                    {destination.completed
                      ? destination.usedStation
                        ? 'Completed using station'
                        : 'Completed'
                      : 'Incomplete'}
                  </small>
                  <strong>{formatSigned(destination.scoreContribution)}</strong>
                </article>
              ))
            ) : (
              <p className="empty-note">No destination tickets.</p>
            )}
            <p className="score-breakdown-subtotal">
              Destination subtotal: {formatSigned(breakdown.destinationSubtotal)}
            </p>
          </section>

          <section className="score-breakdown-section">
            <h3>Stations</h3>
            <article className="score-breakdown-row">
              <span>Unused stations: {breakdown.stationsRemaining}</span>
              <small>{breakdown.stationsRemaining} x 4 points</small>
              <strong>+{breakdown.stationBonus}</strong>
            </article>
          </section>

          <section className="score-breakdown-section">
            <h3>Longest Route</h3>
            <article className="score-breakdown-row">
              <span>Current longest route: {breakdown.longestRouteLength} trains</span>
              <small>Projected bonus</small>
              <strong>+{breakdown.longestRouteBonus}</strong>
            </article>
          </section>
        </div>

        <footer className="score-breakdown-total">
          <span>Projected total</span>
          <strong>{breakdown.projectedTotal}</strong>
        </footer>
      </section>
    </div>
  );
}
