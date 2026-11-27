/**
 * 좌표·거리 유틸.
 *
 * 설계 원칙
 * - 목록 정렬에 쓰이는 거리(distanceM)는 "데이터 계층"이 계산한다.
 *   mock 모드에서는 mockDb가 haversineM()을 사용하고,
 *   supabase 모드에서는 PostGIS(st_distance)가 계산한 값을 그대로 받는다.
 *   => 화면 컴포넌트는 절대 거리 계산을 다시 하지 않는다.
 * - 지도 렌더링용 투영(project/unproject)은 순수 화면 계산이므로 클라이언트에서 수행한다.
 */

/** WGS84 평균 반지름 (m) */
export const EARTH_RADIUS_M = 6371008.8;

const TILE_SIZE = 256;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export interface LatLng {
  lat: number;
  lng: number;
}

/** 두 좌표 사이의 대권 거리 (m). PostGIS st_distance(geography)와 같은 의미. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 위경도 → 월드 픽셀 좌표 (Web Mercator) */
export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sinLat = Math.sin(toRad(clampedLat));
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** 월드 픽셀 좌표 → 위경도 */
export function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (y / scale);
  const lat = toDeg(Math.atan(Math.sinh(n)));
  return { lat, lng };
}

/** 해당 줌에서 1픽셀이 몇 미터인지 (위도 보정 포함) */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos(toRad(lat))) / 2 ** zoom;
}

/** 반경(m)을 모두 담을 수 있는 줌 레벨 추정 */
export function zoomForRadius(radiusM: number, lat: number, viewportPx: number): number {
  const targetMpp = (radiusM * 2.4) / viewportPx;
  const zoom = Math.log2((156543.03392 * Math.cos(toRad(lat))) / targetMpp);
  return Math.max(10, Math.min(16, zoom));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '-';
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
