import { useMemo, useState, type MouseEvent } from 'react';
import { CityNode } from './CityNode';
import { RoutePath } from './RoutePath';
import { RouteInfoTooltip } from './RouteInfoTooltip';
import type { City, GameMap, Route } from '../../types/map';
import type { RouteOwnership, StationOwnership } from '../../game/gameTypes';

interface BoardProps {
  map: GameMap;
  routeOwnership?: RouteOwnership;
  stationOwnership?: StationOwnership;
  playerColorsById?: Record<string, string>;
  playerNamesById?: Record<string, string>;
  stationPlacementActive?: boolean;
  debug?: boolean;
  onRouteSelect?: (route: Route) => void;
  onCitySelect?: (city: City) => void;
}

function getNormalizedPoint(event: MouseEvent<SVGSVGElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

export function Board({
  map,
  routeOwnership = {},
  stationOwnership = {},
  playerColorsById = {},
  playerNamesById = {},
  stationPlacementActive = false,
  debug = false,
  onRouteSelect,
  onCitySelect,
}: BoardProps) {
  const citiesById = useMemo(
    () => new Map(map.cities.map((city) => [city.id, city])),
    [map.cities],
  );
  const boardSize = {
    width: map.imageWidth,
    height: map.imageHeight,
  };
  const [hoveredRoute, setHoveredRoute] = useState<Route | undefined>();
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const updateRouteTooltip = (route: Route, event: MouseEvent<SVGGElement>) => {
    const tooltipWidth = 230;
    const tooltipHeight = route.type === 'ferry' ? 176 : 148;
    const offset = 14;
    const x =
      event.clientX + tooltipWidth + offset > window.innerWidth
        ? event.clientX - tooltipWidth - offset
        : event.clientX + offset;
    const y =
      event.clientY + tooltipHeight + offset > window.innerHeight
        ? event.clientY - tooltipHeight - offset
        : event.clientY + offset;

    setHoveredRoute(route);
    setTooltipPosition({
      x: Math.max(8, x),
      y: Math.max(8, y),
    });
  };

  const handleCitySelect = (city: City) => {
    console.log(`Selected city: ${city.name}`);
    onCitySelect?.(city);
  };

  const handleRouteSelect = (route: Route) => {
    console.log(`Selected route: ${route.id}`);
    onRouteSelect?.(route);
  };

  const handleBoardClick = (event: MouseEvent<SVGSVGElement>) => {
    if (!debug) {
      return;
    }

    const point = getNormalizedPoint(event);
    console.log(`Board coordinate: x=${point.x.toFixed(3)}, y=${point.y.toFixed(3)}`);
  };

  return (
    <section className="board-shell" aria-label={`${map.name} board`}>
      <div className="board-frame">
        <img className="board-image" src={map.imageSrc} alt={map.imageAlt} draggable="false" />
        <svg
          className="board-overlay"
          viewBox={`0 0 ${map.imageWidth} ${map.imageHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${map.name} route and city overlay`}
          onClick={handleBoardClick}
        >
          {map.routes.map((route) => (
            <RoutePath
              key={route.id}
              route={route}
              citiesById={citiesById}
              boardSize={boardSize}
              ownerId={routeOwnership[route.id]}
              ownerColor={
                routeOwnership[route.id] ? playerColorsById[routeOwnership[route.id]] : undefined
              }
              debug={debug}
              onSelect={handleRouteSelect}
              onHover={updateRouteTooltip}
              onMove={updateRouteTooltip}
              onLeave={() => setHoveredRoute(undefined)}
            />
          ))}
          {map.cities.map((city) => (
            <CityNode
              key={city.id}
              city={city}
              boardSize={boardSize}
              stationOwnerColor={
                stationOwnership[city.id] ? playerColorsById[stationOwnership[city.id]] : undefined
              }
              stationPlacementActive={stationPlacementActive}
              stationOccupied={Boolean(stationOwnership[city.id])}
              debug={debug}
              onSelect={handleCitySelect}
            />
          ))}
        </svg>
      </div>
      {hoveredRoute && (
        <RouteInfoTooltip
          route={hoveredRoute}
          fromName={citiesById.get(hoveredRoute.from)?.name ?? hoveredRoute.from}
          toName={citiesById.get(hoveredRoute.to)?.name ?? hoveredRoute.to}
          ownerName={
            routeOwnership[hoveredRoute.id]
              ? playerNamesById[routeOwnership[hoveredRoute.id]]
              : undefined
          }
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </section>
  );
}
