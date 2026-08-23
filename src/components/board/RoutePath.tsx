import type { CSSProperties, MouseEvent } from 'react';
import type { City, Route } from '../../types/map';

interface BoardSize {
  width: number;
  height: number;
}

interface RoutePathProps {
  route: Route;
  citiesById: Map<string, City>;
  boardSize: BoardSize;
  ownerId?: string;
  ownerColor?: string;
  debug?: boolean;
  onSelect: (route: Route) => void;
  onHover?: (route: Route, event: MouseEvent<SVGGElement>) => void;
  onMove?: (route: Route, event: MouseEvent<SVGGElement>) => void;
  onLeave?: () => void;
}

const TRAIN_SPACE_WIDTH = 28;
const TRAIN_SPACE_HEIGHT = 9;
const CITY_CLEARANCE = 16;
const LANE_OFFSET = 12;

function toBoardPoint(city: City, boardSize: BoardSize) {
  return {
    x: city.x * boardSize.width,
    y: city.y * boardSize.height,
  };
}

function getCurvePoint(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number,
) {
  const inverse = 1 - t;

  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function getCurveTangent(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number,
) {
  return {
    x: 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
    y: 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y),
  };
}

export function RoutePath({
  route,
  citiesById,
  boardSize,
  ownerId,
  ownerColor,
  debug = false,
  onSelect,
  onHover,
  onMove,
  onLeave,
}: RoutePathProps) {
  const fromCity = citiesById.get(route.from);
  const toCity = citiesById.get(route.to);

  if (!fromCity || !toCity) {
    console.warn(`Route "${route.id}" references an unknown city.`);
    return null;
  }

  const start = toBoardPoint(fromCity, boardSize);
  const end = toBoardPoint(toCity, boardSize);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const routeDistance = Math.hypot(dx, dy);
  const normal = routeDistance === 0 ? { x: 0, y: 0 } : { x: -dy / routeDistance, y: dx / routeDistance };
  const laneOffset = (route.lane ?? 0) * LANE_OFFSET;
  const curveOffset = route.curve ?? 0;
  const laneStart = {
    x: start.x + normal.x * laneOffset,
    y: start.y + normal.y * laneOffset,
  };
  const laneEnd = {
    x: end.x + normal.x * laneOffset,
    y: end.y + normal.y * laneOffset,
  };
  const control = {
    x: (start.x + end.x) / 2 + normal.x * (laneOffset + curveOffset),
    y: (start.y + end.y) / 2 + normal.y * (laneOffset + curveOffset),
  };
  const usableDistance = Math.max(routeDistance - CITY_CLEARANCE * 2, routeDistance * 0.55);
  const spaceWidth = Math.min(TRAIN_SPACE_WIDTH, Math.max(16, usableDistance / route.length - 5));
  const routeColor = route.color ?? 'gray';
  const routeType = route.type ?? 'normal';
  const ownerStyle = ownerColor
    ? ({ '--owner-color': ownerColor } as CSSProperties)
    : undefined;

  const label = debug
    ? [
        route.id,
        `${route.from} to ${route.to}`,
        `length ${route.length}`,
        `color ${routeColor}`,
        `type ${routeType}`,
        routeType === 'ferry'
          ? `locomotives required ${route.locomotivesRequired ?? 0}`
          : undefined,
        route.curve === undefined ? undefined : `curve ${route.curve}`,
        route.lane === undefined ? undefined : `lane ${route.lane}`,
        ownerId === undefined ? undefined : `owned by ${ownerId}`,
      ]
        .filter(Boolean)
        .join(', ')
    : route.id;

  return (
    <g
      className="route-path"
      data-route-color={routeColor}
      data-route-type={routeType}
      data-claimed={ownerId ? 'true' : 'false'}
      style={ownerStyle}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(route);
      }}
      onMouseEnter={(event) => onHover?.(route, event)}
      onMouseMove={(event) => onMove?.(route, event)}
      onMouseLeave={onLeave}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(route);
        }
      }}
    >
      {Array.from({ length: route.length }, (_, index) => {
        const step = (index + 1) / (route.length + 1);
        const point = getCurvePoint(laneStart, control, laneEnd, step);
        const tangent = getCurveTangent(laneStart, control, laneEnd, step);
        const angle = (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;

        return (
          <g key={`${route.id}-${index}`} transform={`translate(${point.x} ${point.y}) rotate(${angle})`}>
            <rect
              className="route-path__space"
              x={-spaceWidth / 2}
              y={-TRAIN_SPACE_HEIGHT / 2}
              width={spaceWidth}
              height={TRAIN_SPACE_HEIGHT}
              rx="4"
            />
            {routeType === 'ferry' && index < (route.locomotivesRequired ?? 0) && (
              <g className="route-path__ferry-marker">
                <circle r="4.2" />
                <text y="2.7" textAnchor="middle">
                  L
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
