import { useEffect, useState } from 'react';
import type { DestinationTicket } from '../../game/gameTypes';
import { DestinationTicketCard } from './DestinationTicketCard';

interface DestinationTicketSelectionPanelProps {
  playerName: string;
  tickets: DestinationTicket[];
  minKeep: number;
  getCityName: (cityId: string) => string;
  onConfirm: (keptTicketIds: string[]) => void;
}

export function DestinationTicketSelectionPanel({
  playerName,
  tickets,
  minKeep,
  getCityName,
  onConfirm,
}: DestinationTicketSelectionPanelProps) {
  const [selectedTicketIds, setSelectedTicketIds] = useState(() =>
    tickets.map((ticket) => ticket.id),
  );

  useEffect(() => {
    setSelectedTicketIds(tickets.map((ticket) => ticket.id));
  }, [tickets]);

  const toggleTicket = (ticketId: string) => {
    setSelectedTicketIds((current) =>
      current.includes(ticketId)
        ? current.filter((selectedTicketId) => selectedTicketId !== ticketId)
        : [...current, ticketId],
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
        <div>
          <p className="panel-label">Destination tickets</p>
          <h2 id="ticket-selection-title">Choose your destination tickets</h2>
          <p>
            {playerName}, keep at least {minKeep}.
          </p>
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

        <button type="button" disabled={!canConfirm} onClick={() => onConfirm(selectedTicketIds)}>
          Select Routes
        </button>
      </section>
    </div>
  );
}
