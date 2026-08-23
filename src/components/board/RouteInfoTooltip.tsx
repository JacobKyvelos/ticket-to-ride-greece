import type { Route } from '../../types/map';

interface RouteInfoTooltipProps {
  route: Route;
  fromName: string;
  toName: string;
  ownerName?: string;
  x: number;
  y: number;
}

function formatValue(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

export function RouteInfoTooltip({
  route,
  fromName,
  toName,
  ownerName,
  x,
  y,
}: RouteInfoTooltipProps) {
  const routeColor = route.color ?? 'gray';
  const routeType = route.type ?? 'normal';

  return (
    <aside
      className="route-info-tooltip"
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <h2>
        {fromName} to {toName}
      </h2>
      <dl>
        <div>
          <dt>Length</dt>
          <dd>{route.length}</dd>
        </div>
        <div>
          <dt>Color</dt>
          <dd>{formatValue(routeColor)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{formatValue(routeType)}</dd>
        </div>
        {routeType === 'ferry' && (
          <div>
            <dt>Locomotives</dt>
            <dd>{route.locomotivesRequired ?? 0}</dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd>{ownerName ? `Owned by ${ownerName}` : 'Unclaimed'}</dd>
        </div>
      </dl>
    </aside>
  );
}
