import type { DestinationTicket } from '../../game/gameTypes';

interface DestinationTicketCardProps {
  ticket: DestinationTicket;
  selected: boolean;
  getCityName: (cityId: string) => string;
  onToggle: (ticketId: string) => void;
}

export function DestinationTicketCard({
  ticket,
  selected,
  getCityName,
  onToggle,
}: DestinationTicketCardProps) {
  return (
    <button
      type="button"
      className="destination-ticket-card"
      data-selected={selected}
      aria-pressed={selected}
      onClick={() => onToggle(ticket.id)}
    >
      <span className="destination-ticket-card__check">{selected ? '✓' : ''}</span>
      <span className="destination-ticket-card__route">
        <strong>
          {getCityName(ticket.from)} to {getCityName(ticket.to)}
        </strong>
        <small>{ticket.points} points</small>
      </span>
    </button>
  );
}
