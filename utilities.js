
export function getRandomBoolean() {
  return Math.random() >= 0.5;
}

export function getRandomFloatOutsideInterval(halfWidth, maxDist) {
    const dist = (maxDist/2.0) + THREE.MathUtils.randFloatSpread(maxDist);
    return getRandomBoolean() ? -1 * halfWidth - dist : halfWidth + dist;
}

export function sphericalToCartesian(r, theta, phi) {
  const x = r * Math.sin(theta) * Math.cos(phi);
  const y = r * Math.sin(theta) * Math.sin(phi);
  const z = r * Math.cos(theta);
  return { x, y, z };
}

// Function to parse CSV text into a matrix
export function parseCSV(csvText) {
  return csvText.trim().split('\n').map(row => row.split(','));
}