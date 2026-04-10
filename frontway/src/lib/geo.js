const R_EARTH_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * 두 지점 사이의 대권 거리(표면 거리, m).
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R_EARTH_M * c;
}

/**
 * 구면 위 두 점을 잇는 최단 경로 상의 중점(대권 중점).
 */
export function geodesicMidpoint(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1);
  const λ1 = toRad(lng1);
  const φ2 = toRad(lat2);
  const λ2 = toRad(lng2);

  const x1 = Math.cos(φ1) * Math.cos(λ1);
  const y1 = Math.cos(φ1) * Math.sin(λ1);
  const z1 = Math.sin(φ1);
  const x2 = Math.cos(φ2) * Math.cos(λ2);
  const y2 = Math.cos(φ2) * Math.sin(λ2);
  const z2 = Math.sin(φ2);

  let x = x1 + x2;
  let y = y1 + y2;
  let z = z1 + z2;
  const len = Math.hypot(x, y, z);
  if (len < 1e-12) {
    return { lat: lat1, lng: lng1 };
  }
  x /= len;
  y /= len;
  z /= len;

  const φm = Math.asin(Math.max(-1, Math.min(1, z)));
  const λm = Math.atan2(y, x);
  return { lat: (φm * 180) / Math.PI, lng: (λm * 180) / Math.PI };
}

/**
 * 중심에서 반경(m) 이내에 있는지(대권 거리 기준).
 */
export function isWithinRadiusMeters(
  centerLat,
  centerLng,
  radiusM,
  pointLat,
  pointLng,
  epsilonM = 2
) {
  return (
    haversineMeters(centerLat, centerLng, pointLat, pointLng) <=
    radiusM + epsilonM
  );
}
