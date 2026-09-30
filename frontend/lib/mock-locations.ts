/**
 * Made-up friend positions for MapsPage. There is no positions endpoint and
 * none is planned, so these live here — deliberately not in lib/api.
 */
export type LatLng = { latitude: number; longitude: number };

export type MockFriendLocation = LatLng & { username: string };

/** Offsets in degrees from your own position (0.005° is roughly 300–550 m).
 *  Fixed rather than random, so markers don't jump between renders. */
const OFFSETS = [
  { username: 'moises', dLat: 0.004, dLng: -0.005 },
  { username: 'sara', dLat: -0.003, dLng: 0.006 },
  { username: 'kalle', dLat: 0.006, dLng: 0.003 },
];

export function friendLocationsAround(center: LatLng): MockFriendLocation[] {
  return OFFSETS.map(({ username, dLat, dLng }) => ({
    username,
    latitude: center.latitude + dLat,
    longitude: center.longitude + dLng,
  }));
}
