import type { DestinationTicket } from '../../game/gameTypes';
import { DestinationTicketCard } from './DestinationTicketCard';

interface DestinationTicketSelectionPanelProps {
  playerName: string;
  tickets: DestinationTicket[];
  minKeep: number;
  selectedTicketIds: string[];
  onSelectedTicketIdsChange: (ticketIds: string[]) => void;
  getCityName: (cityId: string) => string;
  onMinimize: () => void;
  onConfirm: (keptTicketIds: string[]) => void;
}

export function DestinationTicketSelectionPanel({
  playerName,
  tickets,
  minKeep,
  selectedTicketIds,
  onSelectedTicketIdsChange,
  getCityName,
  onMinimize,
  onConfirm,
}: DestinationTicketSelectionPanelProps) {
  const toggleTicket = (ticketId: string) => {
    onSelectedTicketIdsChange(
      selectedTicketIds.includes(ticketId)
        ? selectedTicketIds.filter((selectedTicketId) => selectedTicketId !== ticketId)
        : [...selectedTicketIds, ticketId],
    );
  };

  const canConfirm = selectedTicketIds.length >= minKeep;

  return (
    <div className="ticket-modal-backdrop" role="presentation">
      <section
        className="ticket-selection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-selection-title"
      >
        <div className="ticket-selection-modal__header">
          <div>
            <p className="panel-label">Destination tickets</p>
            <h2 id="ticket-selection-title">Choose your destination tickets</h2>
            <p>
              {playerName}, keep at least {minKeep}.
            </p>
          </div>
          <button type="button" className="secondary-button" onClick={onMinimize}>
            Minimize
          </button>
        </div>

        <div className="destination-ticket-options">
          {tickets.map((ticket) => (
            <DestinationTicketCard
              key={ticket.id}
              ticket={ticket}
              selected={selectedTicketIds.includes(ticket.id)}
              getCityName={getCityName}
              onToggle={toggleTicket}
            />
          ))}
        </div>

        <footer className="ticket-selection-modal__actions">
          <button type="button" disabled={!canConfirm} onClick={() => onConfirm(selectedTicketIds)}>
            Select Routes
          </button>
        </footer>
      </section>
    </div>
  );
}
