import { z } from "zod";

import type { LatLngTuple } from "@/lib/geo";

/** Situação de uma área ao longo do ciclo de plantio. */
export const AREA_STATUSES = [
  "PLANEJADA",
  "EM_PLANTIO",
  "PLANTADA",
  "CONCLUIDA",
] as const;

export type AreaStatus = (typeof AREA_STATUSES)[number];

export const STATUS_LABELS: Record<AreaStatus, string> = {
  PLANEJADA: "Planejada",
  EM_PLANTIO: "Em plantio",
  PLANTADA: "Plantada",
  CONCLUIDA: "Concluída",
};

/** Cor de cada situação, usada no polígono do mapa e nas etiquetas da lista. */
export const STATUS_COLORS: Record<AreaStatus, string> = {
  PLANEJADA: "#a16207",
  EM_PLANTIO: "#0284c7",
  PLANTADA: "#16a34a",
  CONCLUIDA: "#6d28d9",
};

const invalidCoordinate = { error: "Coordenada fora do intervalo válido." };

/** Um vértice do polígono: `[latitude, longitude]` em graus decimais. */
const coordinateSchema = z.tuple(
  [
    z.number(invalidCoordinate).min(-90, invalidCoordinate).max(90, invalidCoordinate),
    z
      .number(invalidCoordinate)
      .min(-180, invalidCoordinate)
      .max(180, invalidCoordinate),
  ],
  invalidCoordinate,
);

/**
 * Validação dos dados que o formulário envia ao servidor.
 *
 * Um polígono precisa de ao menos três vértices para delimitar uma área; o
 * limite superior evita que um desenho acidental com milhares de pontos seja
 * persistido.
 */
export const areaInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe um nome com pelo menos 2 caracteres.")
    .max(120, "O nome deve ter no máximo 120 caracteres."),
  species: z
    .string()
    .trim()
    .max(120, "A espécie deve ter no máximo 120 caracteres.")
    .optional()
    .transform((value) => value || undefined),
  description: z
    .string()
    .trim()
    .max(1000, "A descrição deve ter no máximo 1000 caracteres.")
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(AREA_STATUSES, {
    error: "Selecione uma situação válida para a área.",
  }),
  coordinates: z
    .array(coordinateSchema)
    .min(3, "Desenhe ao menos 3 pontos para delimitar a área.")
    .max(500, "A área tem pontos demais. Simplifique o desenho."),
});

export type AreaInput = z.infer<typeof areaInputSchema>;

/** Área como consumida pela interface: já com coordenadas desserializadas. */
export type PlantingAreaView = {
  id: string;
  name: string;
  species: string | null;
  description: string | null;
  status: AreaStatus;
  coordinates: LatLngTuple[];
  areaM2: number;
  perimeterM: number;
  center: LatLngTuple;
  createdAt: string;
};

/**
 * Converte o JSON armazenado em `PlantingArea.coordinates` de volta para tuplas.
 * Retorna uma lista vazia se o conteúdo estiver corrompido, para que um único
 * registro inválido não derrube a listagem inteira.
 */
export function parseCoordinates(raw: string): LatLngTuple[] {
  try {
    const parsed = z.array(coordinateSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function isAreaStatus(value: string): value is AreaStatus {
  return (AREA_STATUSES as readonly string[]).includes(value);
}
