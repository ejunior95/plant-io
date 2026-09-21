import "server-only";

import { headers } from "next/headers";
import { z } from "zod";

import type { LatLngTuple } from "@/lib/geo";

/**
 * Localização aproximada de quem acessa, deduzida do endereço IP.
 *
 * Serve apenas para abrir o mapa numa região útil em vez da visão nacional.
 * Nenhuma decisão sobre dados depende deste valor, o que é o que torna
 * aceitável confiar em cabeçalhos que o cliente poderia forjar.
 */

/** Endereço do serviço de consulta; a variável de ambiente pode trocá-lo. */
const DEFAULT_ENDPOINT = "https://ipwho.is";

/**
 * Nível de aproximação para uma cidade conhecida.
 *
 * Fica um degrau abaixo dos outros movimentos de câmera da aplicação — 17 para
 * o GPS do aparelho, 15 para um endereço pesquisado — porque o IP localiza o
 * usuário no município, não no terreno. Um zoom maior sugeriria uma precisão
 * que o dado não tem.
 */
const CITY_ZOOM = 9;

/** Quando só o país é conhecido, o enquadramento precisa ser nacional. */
const COUNTRY_ZOOM = 5;

/** A página não pode esperar por um serviço externo para ser entregue. */
const LOOKUP_TIMEOUT_MS = 1_500;

/** Um IP não muda de cidade ao longo do dia. */
const LOOKUP_REVALIDATE_S = 86_400;

/**
 * O ipwho.is responde 200 mesmo quando não consegue localizar — em faixas
 * reservadas e quando a cota é excedida — sinalizando a falha apenas em
 * `success`. Sem validar este campo, esses casos passariam por sucesso.
 */
const ipLocationSchema = z.object({
  success: z.literal(true),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().nullish(),
});

export type IpLocation = { center: LatLngTuple; zoom: number };

export async function lookupIpLocation(): Promise<IpLocation | null> {
  // Definir a variável como vazia desliga a consulta sem alterar o código.
  const endpoint = process.env.IP_LOCATION_ENDPOINT ?? DEFAULT_ENDPOINT;
  if (!endpoint) return null;

  const ip = await clientIp();

  // Sem um IP público de quem acessa — o caso de `npm run dev`, em que a
  // requisição vem de `::1` — o caminho vazio faz o serviço localizar quem o
  // chamou, ou seja, a própria máquina que roda a aplicação.
  const url = new URL(ip ? `/${ip}` : "/", endpoint);
  url.searchParams.set("fields", "success,latitude,longitude,city");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      // O cache é opcional nesta versão do Next.js: sem `revalidate` cada
      // acesso sairia à rede de novo.
      next: { revalidate: LOOKUP_REVALIDATE_S },
    });

    if (!response.ok) return null;

    const parsed = ipLocationSchema.safeParse(await response.json());
    if (!parsed.success) return null;

    return {
      center: [parsed.data.latitude, parsed.data.longitude],
      zoom: parsed.data.city ? CITY_ZOOM : COUNTRY_ZOOM,
    };
  } catch {
    // Tempo esgotado, serviço fora do ar ou resposta ilegível. O mapa tem um
    // enquadramento padrão para esse caso; derrubar a página seria pior.
    return null;
  }
}

/**
 * Endereço IP de quem fez a requisição, ou `null` se não for possível deduzi-lo.
 *
 * Estes cabeçalhos são preenchidos por proxies e podem ser forjados por quem
 * chama. Aqui isso só permitiria escolher onde o próprio mapa abre, então não
 * há o que proteger.
 *
 * Em produção na Vercel ou na Cloudflare a posição já chega pronta em
 * cabeçalhos próprios (`x-vercel-ip-latitude`, `cf-iplatitude`), o que
 * dispensaria a consulta externa — vale considerar quando houver deploy.
 */
async function clientIp(): Promise<string | null> {
  const headerList = await headers();

  // `x-forwarded-for` acumula a cadeia de proxies, do cliente ao último salto.
  const candidates = [
    ...(headerList.get("x-forwarded-for")?.split(",") ?? []),
    headerList.get("x-real-ip") ?? "",
  ];

  // O primeiro endereço público da lista é o mais próximo do cliente real. Vale
  // percorrer todos em vez de parar no primeiro cabeçalho presente: o próprio
  // `next dev` preenche `x-forwarded-for` com o endereço do soquete (`::1`), e um
  // proxy reverso pode anunciar o cliente só em `x-real-ip`.
  return candidates.map((value) => normalize(value.trim())).find(isRoutable) ?? null;
}

function normalize(raw: string): string {
  // Alguns proxies entregam o IPv6 entre colchetes e anexam a porta de origem.
  // Em IPv4 o `:` separa a porta; em IPv6 ele faz parte do próprio endereço.
  const withoutBrackets = raw.replace(/^\[|\](:\d+)?$/g, "");
  const withoutPort = withoutBrackets.includes(".")
    ? withoutBrackets.replace(/:\d+$/, "")
    : withoutBrackets;

  return withoutPort.toLowerCase();
}

/**
 * Descarta endereços que nunca descrevem uma localização geográfica: loopback,
 * redes privadas, link-local e o CGNAT das operadoras. Consultá-los só gastaria
 * uma ida à rede para receber "faixa reservada" de volta.
 */
function isRoutable(ip: string): boolean {
  if (!ip || ip === "::" || ip === "::1" || ip === "0.0.0.0") return false;

  return !/^(0\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fe80:|f[cd])/.test(
    ip,
  );
}
