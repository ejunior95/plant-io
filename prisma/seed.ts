/**
 * Popula o banco com áreas de exemplo, para que a aplicação possa ser
 * demonstrada sem depender de cadastro manual.
 *
 * Execute com: npm run db:seed
 */
import "dotenv/config";

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  polygonAreaM2,
  polygonCenter,
  polygonPerimeterM,
  type LatLngTuple,
} from "../lib/geo";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

/** Região rural nos arredores de Botucatu (SP), usada como cenário fictício. */
const exemplos: Array<{
  name: string;
  species: string;
  description: string;
  status: string;
  coordinates: LatLngTuple[];
}> = [
  {
    name: "Talhão 1 — Encosta norte",
    species: "Ipê-amarelo (Handroanthus albus)",
    description:
      "Solo argiloso, espaçamento de 3×2 m. Plantio concluído na primeira semana de março.",
    status: "PLANTADA",
    coordinates: [
      [-22.8801, -48.4452],
      [-22.8801, -48.4418],
      [-22.8829, -48.4418],
      [-22.8829, -48.4452],
    ],
  },
  {
    name: "Talhão 2 — Beira do córrego",
    species: "Ingá-de-metro (Inga edulis)",
    description:
      "Faixa de recomposição de mata ciliar, acompanhando o curso d'água.",
    status: "EM_PLANTIO",
    coordinates: [
      [-22.8838, -48.4462],
      [-22.8845, -48.4430],
      [-22.8858, -48.4425],
      [-22.8862, -48.4448],
      [-22.8849, -48.4468],
    ],
  },
  {
    name: "Talhão 3 — Área de expansão",
    species: "Eucalipto (Eucalyptus urophylla)",
    description:
      "Terreno em preparo. Plantio previsto para o início do período chuvoso.",
    status: "PLANEJADA",
    coordinates: [
      [-22.8775, -48.4405],
      [-22.8772, -48.4362],
      [-22.8802, -48.4358],
      [-22.8806, -48.4402],
    ],
  },
];

async function main() {
  // O seed é idempotente: recria o conjunto de exemplo a cada execução.
  await prisma.plantingArea.deleteMany();

  for (const exemplo of exemplos) {
    const [centerLat, centerLng] = polygonCenter(exemplo.coordinates);

    await prisma.plantingArea.create({
      data: {
        name: exemplo.name,
        species: exemplo.species,
        description: exemplo.description,
        status: exemplo.status,
        coordinates: JSON.stringify(exemplo.coordinates),
        areaM2: polygonAreaM2(exemplo.coordinates),
        perimeterM: polygonPerimeterM(exemplo.coordinates),
        centerLat,
        centerLng,
      },
    });
  }

  const total = await prisma.plantingArea.count();
  console.log(`Seed concluído: ${total} áreas de exemplo cadastradas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
