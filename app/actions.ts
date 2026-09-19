"use server";

import { revalidatePath } from "next/cache";

import { areaInputSchema, type AreaInput } from "@/lib/areas";
import { polygonAreaM2, polygonCenter, polygonPerimeterM } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

/**
 * Resultado uniforme das ações de escrita. Erros de validação voltam como dado
 * — e não como exceção — para que o formulário possa exibi-los ao usuário.
 */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Deriva área, perímetro e centro a partir do polígono.
 *
 * O cálculo é refeito no servidor mesmo já tendo sido feito no navegador para
 * desenhar a prévia: o cliente pode enviar qualquer valor, então os números
 * persistidos precisam vir de uma fonte confiável.
 */
function measure(coordinates: AreaInput["coordinates"]) {
  const [centerLat, centerLng] = polygonCenter(coordinates);

  return {
    coordinates: JSON.stringify(coordinates),
    areaM2: polygonAreaM2(coordinates),
    perimeterM: polygonPerimeterM(coordinates),
    centerLat,
    centerLng,
  };
}

function validate(input: unknown) {
  const parsed = areaInputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data, error: null } as const;

  const firstIssue = parsed.error.issues[0];
  return {
    data: null,
    error: firstIssue?.message ?? "Dados inválidos.",
  } as const;
}

export async function createArea(input: unknown): Promise<ActionResult> {
  const { data, error } = validate(input);
  if (!data) return { ok: false, error };

  await prisma.plantingArea.create({
    data: {
      name: data.name,
      species: data.species,
      description: data.description,
      status: data.status,
      ...measure(data.coordinates),
    },
  });

  revalidatePath("/");
  return { ok: true };
}

export async function updateArea(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Área não identificada." };

  const { data, error } = validate(input);
  if (!data) return { ok: false, error };

  const existing = await prisma.plantingArea.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Esta área não existe mais." };
  }

  await prisma.plantingArea.update({
    where: { id },
    data: {
      name: data.name,
      species: data.species ?? null,
      description: data.description ?? null,
      status: data.status,
      ...measure(data.coordinates),
    },
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteArea(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Área não identificada." };

  const existing = await prisma.plantingArea.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false, error: "Esta área não existe mais." };
  }

  await prisma.plantingArea.delete({ where: { id } });

  revalidatePath("/");
  return { ok: true };
}
