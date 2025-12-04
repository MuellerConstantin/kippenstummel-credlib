export function calculateEwma(
  previousEwma: number,
  currentValue: number,
  alpha: number,
): number {
  return alpha * currentValue + (1 - alpha) * previousEwma;
}

export function calculateSpeed(
  position1: { latitude: number; longitude: number },
  position2: { latitude: number; longitude: number },
  duration: number,
): number {
  const distance = calculateDistanceInKm(position1, position2);
  const durationMs = new Date().getTime() - duration;
  const durationHours = durationMs / (1000 * 60 * 60);
  const speed = distance / durationHours;

  return speed;
}

export function calculateDistanceInKm(
  position1: { latitude: number; longitude: number },
  position2: { latitude: number; longitude: number },
) {
  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const { latitude: lat1, longitude: lon1 } = position1;
  const { latitude: lat2, longitude: lon2 } = position2;

  const EARTH_RADIUS = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS * c;

  return distance;
}

export function isUnrealisticallyMovement(
  lastInteractionPosition: { latitude: number; longitude: number },
  currentPosition: { latitude: number; longitude: number },
  lastInteractionAt: Date,
): boolean {
  const distance = calculateDistanceInKm(
    lastInteractionPosition,
    currentPosition,
  );
  const speed = calculateSpeed(
    lastInteractionPosition,
    currentPosition,
    lastInteractionAt.getTime(),
  );

  let maxAllowedSpeed: number;

  if (distance < 1) {
    // Max 10 km/h for very short distances
    maxAllowedSpeed = 10;
  } else if (distance < 10) {
    // Max 50 km/h for short distances within cities
    maxAllowedSpeed = 50;
  } else if (distance < 100) {
    // Max 120 km/h for medium distances between cities
    maxAllowedSpeed = 120;
  } else if (distance < 500) {
    // Max 200 km/h for long distances between counties or big cities
    maxAllowedSpeed = 200;
  } else if (distance < 1000) {
    // Max 700 km/h for very long distances via aircraft
    maxAllowedSpeed = 700;
  } else {
    // Max 900 km/h for very long distances across continents or oceans
    maxAllowedSpeed = 900;
  }

  return speed > maxAllowedSpeed;
}
