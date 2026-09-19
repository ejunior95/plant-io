import { z } from "zod";

/**
 * Busca de locais por nome, usada para levar o mapa até a região do plantio
 * sem navegação manual desde a visão nacional.
 *
 * A consulta passa pelo servidor — e não direto do navegador — para que a
 * aplicação se identifique ao Nominatim conforme a política de uso do serviço
 * e para manter o endereço do serviço externo fora do código do cliente.
 */

const nominatimResultSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
  }),
);

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return Response.json({ results: [] satisfies GeocodeResult[] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "pt-BR");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Plant.io/1.0 (trabalho academico de mapeamento agricola)",
      },
      // Buscas repetidas pelo mesmo termo não precisam sair de novo à rede.
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return Response.json(
        { error: "O serviço de busca de locais não respondeu." },
        { status: 502 },
      );
    }

    const parsed = nominatimResultSchema.safeParse(await response.json());
    if (!parsed.success) {
      return Response.json(
        { error: "Resposta inesperada do serviço de busca." },
        { status: 502 },
      );
    }

    const results: GeocodeResult[] = parsed.data.map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));

    return Response.json({ results });
  } catch {
    return Response.json(
      { error: "Não foi possível consultar o serviço de busca." },
      { status: 502 },
    );
  }
}
