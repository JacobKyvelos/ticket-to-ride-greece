import type { PaymentOption } from '../../game/gameTypes';

interface StationPlacementPanelProps {
  cityName?: string;
  paymentOptions: PaymentOption[];
  onChoosePayment: (payment: PaymentOption) => void;
  onCancel: () => void;
}

function formatPayment(payment: PaymentOption) {
  if (payment.paymentColor === 'locomotive') {
    return `${payment.locomotives} locomotives`;
  }

  const parts = [`${payment.normalCards} ${payment.paymentColor}`];

  if (payment.locomotives > 0) {
    parts.push(`${payment.locomotives} locomotive${payment.locomotives === 1 ? '' : 's'}`);
  }

  return parts.join(' + ');
}

export function StationPlacementPanel({
  cityName,
  paymentOptions,
  onChoosePayment,
  onCancel,
}: StationPlacementPanelProps) {
  return (
    <section className="payment-panel station-placement-panel" aria-label="Station placement">
      <div>
        <p className="panel-label">Place station</p>
        <h2>{cityName ? cityName : 'Choose a city'}</h2>
        <p>{cityName ? 'Choose payment.' : 'Click an eligible city on the board.'}</p>
      </div>

      {cityName && (
        <div className="payment-options">
          {paymentOptions.map((payment) => (
            <button
              key={`${payment.paymentColor}-${payment.normalCards}-${payment.locomotives}`}
              type="button"
              onClick={() => onChoosePayment(payment)}
            >
              {formatPayment(payment)}
            </button>
          ))}
        </div>
      )}

      <button type="button" className="secondary-button" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
