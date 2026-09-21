import type { PlantingAreaView } from "@/lib/areas";
import type { LatLngTuple } from "@/lib/geo";
import type { IpLocation } from "@/lib/ip-location";

/**
 * Enquadramento do mapa: um ponto com zoom, ou um retângulo que contenha uma
 * lista de pontos. É a mesma forma usada tanto na criação do mapa quanto nos
 * reposicionamentos posteriores da câmera.
 */
export type MapView =
  | { kind: "point"; center: LatLngTuple; zoom: number }
  | { kind: "bounds"; points: LatLngTuple[] };

/**
 * Centro aproximado do Brasil — último recurso, quando nada mais é conhecido.
 *
 * O tipo fixa a variante `point` para que quem só precisa do centro e do zoom
 * possa lê-los sem estreitar a união antes.
 */
export const BRAZIL_VIEW: Extract<MapView, { kind: "point" }> = {
  kind: "point",
  center: [-15.78, -47.93],
  zoom: 4,
};

/**
 * Onde o mapa abre.
 *
 * As áreas já cadastradas vêm antes de tudo: quem tem plantios registrados quer
 * voltar para eles, e o retângulo que os contém é mais preciso do que qualquer
 * estimativa. Só quando não há nada cadastrado é que a região do IP ajuda, e
 * ela por sua vez só entra quando a consulta funcionou.
 */
export function resolveInitialView(
  areas: PlantingAreaView[],
  ip: IpLocation | null,
): MapView {
  const points = areas.flatMap((area) => area.coordinates);
  if (points.length > 0) return { kind: "bounds", points };

  if (ip) return { kind: "point", center: ip.center, zoom: ip.zoom };

  return BRAZIL_VIEW;
}
