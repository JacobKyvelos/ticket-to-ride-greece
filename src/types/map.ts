export interface City {
  id: string;
  name: string;
  nameEl?: string;
  x: number;
  y: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
}

export type RouteColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'black'
  | 'white'
  | 'orange'
  | 'pink'
  | 'gray';

export type RouteType = 'normal' | 'tunnel' | 'ferry';

export interface Route {
  id: string;
  from: string;
  to: string;
  length: number;
  color?: RouteColor;
  type?: RouteType;
  locomotivesRequired?: number;
  curve?: number;
  lane?: -1 | 0 | 1;
}

export interface GameMap {
  id: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  cities: City[];
  routes: Route[];
}
