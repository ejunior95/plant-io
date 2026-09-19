/**
 * Cálculos geodésicos sobre polígonos desenhados no mapa.
 *
 * As coordenadas trafegam sempre como tuplas `[latitude, longitude]` em graus
 * decimais (WGS84), que é o mesmo formato aceito pelo Leaflet — assim nenhuma
 * conversão é necessária entre o mapa, o banco e a interface.
 */

/** Raio equatorial da Terra em metros (WGS84). */
const EARTH_RADIUS_M = 6_378_137;

export type LatLngTuple = [lat: number, lng: number];

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Área de um polígono sobre a superfície da esfera, em metros quadrados.
 *
 * Usa o método do excesso esférico: percorrendo as arestas do polígono, cada
 * uma contribui com a área do fuso que ela projeta sobre o equador. A soma das
 * contribuições, multiplicada por R²/2, resulta na área delimitada. O valor
 * absoluto torna o resultado independente do sentido (horário/anti-horário) em
 * que o usuário desenhou o polígono.
 */
export function polygonAreaM2(points: LatLngTuple[]): number {
  if (points.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];

    total +=
      toRadians(lng2 - lng1) *
      (2 + Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
  }

  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/**
 * Distância em metros entre dois pontos pela fórmula de Haversine.
 */
export function distanceM(a: LatLngTuple, b: LatLngTuple): number {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Perímetro do polígono fechado, em metros. */
export function polygonPerimeterM(points: LatLngTuple[]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += distanceM(points[i], points[(i + 1) % points.length]);
  }
  return total;
}

/**
 * Centro geométrico do polígono, usado para centralizar o mapa na área.
 *
 * Aplica a fórmula do centroide de polígono (baseada no produto vetorial das
 * arestas). Em polígonos degenerados — com área nula, como três pontos
 * colineares — a fórmula divide por zero, então caímos na média aritmética dos
 * vértices.
 */
export function polygonCenter(points: LatLngTuple[]): LatLngTuple {
  if (points.length === 0) return [0, 0];
  if (points.length < 3) {
    return averagePoint(points);
  }

  let twiceArea = 0;
  let lat = 0;
  let lng = 0;

  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];

    const cross = lng1 * lat2 - lng2 * lat1;
    twiceArea += cross;
    lat += (lat1 + lat2) * cross;
    lng += (lng1 + lng2) * cross;
  }

  if (twiceArea === 0) return averagePoint(points);

  const factor = 1 / (3 * twiceArea);
  return [lat * factor, lng * factor];
}

function averagePoint(points: LatLngTuple[]): LatLngTuple {
  const sum = points.reduce<[number, number]>(
    ([lat, lng], point) => [lat + point[0], lng + point[1]],
    [0, 0],
  );
  return [sum[0] / points.length, sum[1] / points.length];
}

/** Formata a área em m² ou hectares, conforme a grandeza. */
export function formatArea(areaM2: number): string {
  if (areaM2 < 10_000) {
    return `${formatNumber(areaM2, 0)} m²`;
  }
  return `${formatNumber(areaM2 / 10_000, 2)} ha`;
}

/** Formata uma distância em metros ou quilômetros. */
export function formatDistance(meters: number): string {
  if (meters < 1_000) {
    return `${formatNumber(meters, 0)} m`;
  }
  return `${formatNumber(meters / 1_000, 2)} km`;
}

function formatNumber(value: number, fractionDigits: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** Formata uma coordenada para exibição, com 5 casas (~1 m de precisão). */
export function formatLatLng([lat, lng]: LatLngTuple): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
