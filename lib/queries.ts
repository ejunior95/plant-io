import "server-only";

import { prisma } from "@/lib/prisma";
import {
  isAreaStatus,
  parseCoordinates,
  type PlantingAreaView,
} from "@/lib/areas";

/** Carrega todas as áreas cadastradas, da mais recente para a mais antiga. */
export async function listAreas(): Promise<PlantingAreaView[]> {
  const areas = await prisma.plantingArea.findMany({
    orderBy: { createdAt: "desc" },
  });

  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    species: area.species,
    description: area.description,
    status: isAreaStatus(area.status) ? area.status : "PLANEJADA",
    coordinates: parseCoordinates(area.coordinates),
    areaM2: area.areaM2,
    perimeterM: area.perimeterM,
    center: [area.centerLat, area.centerLng],
    createdAt: area.createdAt.toISOString(),
  }));
}
