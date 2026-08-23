import type { CSSProperties } from 'react';
import type { City } from '../../types/map';

interface CityNodeProps {
  city: City;
  boardSize: {
    width: number;
    height: number;
  };
  stationOwnerColor?: string;
  stationPlacementActive?: boolean;
  stationOccupied?: boolean;
  debug?: boolean;
  onSelect: (city: City) => void;
}

export function CityNode({
  city,
  boardSize,
  stationOwnerColor,
  stationPlacementActive = false,
  stationOccupied = false,
  debug = false,
  onSelect,
}: CityNodeProps) {
  const label = debug
    ? `${city.name} (${city.x.toFixed(3)}, ${city.y.toFixed(3)})`
    : city.name;
  const nodeX = city.x * boardSize.width;
  const nodeY = city.y * boardSize.height;
  const labelOffsetX = city.labelOffsetX ?? 10;
  const labelOffsetY = city.labelOffsetY ?? -8;
  const labelAnchor = city.labelAnchor ?? 'start';

  return (
    <g
      className="city-node"
      data-station-mode={stationPlacementActive}
      data-station-occupied={stationOccupied}
      transform={`translate(${nodeX} ${nodeY})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(city);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(city);
        }
      }}
    >
      <title>{label}</title>
      <text
        className="city-node__label"
        x={labelOffsetX}
        y={labelOffsetY}
        textAnchor={labelAnchor}
      >
        {city.name}
      </text>
      <circle className="city-node__halo" r="7.2" />
      <circle className="city-node__marker" r="4.2" />
      {stationOwnerColor && (
        <g className="city-node__station" style={{ '--station-color': stationOwnerColor } as CSSProperties}>
          <rect x="-8" y="-19" width="16" height="10" rx="2" />
          <path d="M -10 -9 L 0 -17 L 10 -9 Z" />
        </g>
      )}
    </g>
  );
}
