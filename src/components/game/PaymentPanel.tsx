import type { Route } from '../../types/map';
import type { PaymentOption } from '../../game/gameTypes';

interface PaymentPanelProps {
  route?: Route;
  paymentOptions: PaymentOption[];
  getCityName?: (cityId: string) => string;
  onChoosePayment: (payment: PaymentOption) => void;
  onCancel: () => void;
}

function formatPayment(payment: PaymentOption) {
  if (payment.paymentColor === 'locomotive') {
    return `${payment.locomotives} locomotive${payment.locomotives === 1 ? '' : 's'}`;
  }

  const parts = [`${payment.normalCards} ${payment.paymentColor}`];

  if (payment.locomotives > 0) {
    parts.push(`${payment.locomotives} locomotive${payment.locomotives === 1 ? '' : 's'}`);
  }

  return parts.join(' + ');
}

export function PaymentPanel({
  route,
  paymentOptions,
  getCityName,
  onChoosePayment,
  onCancel,
}: PaymentPanelProps) {
  if (!route) {
    return null;
  }

  const routeType = route.type ?? 'normal';
  const routeName = `${getCityName?.(route.from) ?? route.from} to ${getCityName?.(route.to) ?? route.to}`;

  return (
    <section className="payment-panel" aria-label="Route payment">
      <div>
        <p className="panel-label">Claim route</p>
        <h2>{routeName}</h2>
        <p>Type: {routeType}</p>
        <p>Length: {route.length} | Route color: {route.color ?? 'gray'}</p>
        {routeType === 'ferry' && (
          <p>Required locomotives: {route.locomotivesRequired ?? 0}</p>
        )}
      </div>

      <div className="payment-options">
        {paymentOptions.map((payment) => (
          <button
            key={`${payment.paymentColor}-${payment.normalCards}-${payment.locomotives}`}
            type="button"
            onClick={() => onChoosePayment(payment)}
          >
            {routeType === 'tunnel' ? `Attempt tunnel with ${formatPayment(payment)}` : formatPayment(payment)}
          </button>
        ))}
      </div>

      <button type="button" className="secondary-button" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
