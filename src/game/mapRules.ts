import type { Route } from '../types/map';

export function getTotalRouteSpaces(routes: Route[]) {
  return routes.reduce((sum, route) => sum + route.length, 0);
}
