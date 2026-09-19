import MapWorkspace from "@/app/components/map-workspace";
import { listAreas } from "@/lib/queries";

/**
 * As áreas são lidas do banco a cada acesso. Sem isto o Next.js pré-renderiza
 * a página no build e alterações feitas fora da aplicação (pelo Prisma Studio,
 * por exemplo) não apareceriam.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const areas = await listAreas();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="text-xl">
            🌱
          </span>
          <div>
            <h1 className="text-base font-semibold leading-tight text-stone-900">
              Plant.io
            </h1>
            <p className="text-xs text-stone-500">
              Mapeamento de áreas de plantio de mudas
            </p>
          </div>
        </div>
      </header>

      <MapWorkspace areas={areas} />
    </div>
  );
}
