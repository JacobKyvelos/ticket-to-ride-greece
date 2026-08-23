import type { PaymentOption, PendingTunnelAttempt } from '../../game/gameTypes';
import type { Route } from '../../types/map';
import { formatCardColor, TrainCardView } from './TrainCardView';

interface TunnelAttemptPanelProps {
  attempt: PendingTunnelAttempt;
  route?: Route;
  getCityName: (cityId: string) => string;
  onPay: () => void;
  onDecline: () => void;
}

function formatPaymentLabel(payment: PaymentOption) {
  if (payment.paymentColor === 'locomotive') {
    return `${payment.locomotives} locomotive${payment.locomotives === 1 ? '' : 's'}`;
  }

  const parts = [`${payment.normalCards} ${payment.paymentColor}`];

  if (payment.locomotives > 0) {
    parts.push(`${payment.locomotives} locomotive${payment.locomotives === 1 ? '' : 's'}`);
  }

  return parts.join(' + ');
}

export function TunnelAttemptPanel({
  attempt,
  route,
  getCityName,
  onPay,
  onDecline,
}: TunnelAttemptPanelProps) {
  const extraPayment = attempt.extraPaymentOptions[0];

  return (
    <section className="payment-panel tunnel-attempt-panel" aria-label="Tunnel attempt">
      <div>
        <p className="panel-label">Tunnel reveal</p>
        <h2>
          {route ? `${getCityName(route.from)} to ${getCityName(route.to)}` : attempt.routeId}
        </h2>
        <p>Base payment: {formatPaymentLabel(attempt.basePayment)}</p>
        <p>Selected color: {attempt.basePayment.paymentColor}</p>
      </div>

      <div>
        <p className="panel-label">Revealed cards</p>
        <div className="tunnel-reveal-cards">
          {attempt.revealedCards.length > 0 ? (
            attempt.revealedCards.map((card, index) => (
              <TrainCardView
                key={`${card}-${index}`}
                card={card}
                label={`${formatCardColor(card)} train card`}
              />
            ))
          ) : (
            <p className="empty-note">No cards could be revealed.</p>
          )}
        </div>
      </div>

      <p>Extra cost: {attempt.extraCost}</p>
      {extraPayment ? (
        <button type="button" onClick={onPay}>
          Pay + Claim ({formatPaymentLabel(extraPayment)})
        </button>
      ) : (
        <p className="status-message">Not enough cards to pay the extra tunnel cost.</p>
      )}
      <button type="button" className="secondary-button" onClick={onDecline}>
        Decline
      </button>
    </section>
  );
}
