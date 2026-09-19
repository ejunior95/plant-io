"use client";

import {
  STATUS_COLORS,
  STATUS_LABELS,
  type PlantingAreaView,
} from "@/lib/areas";
import { formatArea, formatDistance } from "@/lib/geo";

type Props = {
  areas: PlantingAreaView[];
  selectedId: string | null;
  busyId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function AreaList({
  areas,
  selectedId,
  busyId,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  if (areas.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center">
        <p className="text-sm font-medium text-stone-700">
          Nenhuma área mapeada ainda
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Use o botão “Nova área” para delimitar o primeiro talhão no mapa.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {areas.map((area) => {
        const isSelected = area.id === selectedId;
        const isBusy = area.id === busyId;

        return (
          <li key={area.id}>
            <div
              className={`rounded-lg border p-3 transition ${
                isSelected
                  ? "border-emerald-600 bg-emerald-50 shadow-sm"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(area.id)}
                className="w-full text-left"
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-stone-900">{area.name}</span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS[area.status] }}
                  >
                    {STATUS_LABELS[area.status]}
                  </span>
                </div>

                {area.species && (
                  <p className="mt-0.5 text-xs italic text-stone-600">
                    {area.species}
                  </p>
                )}

                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                  <div className="flex gap-1">
                    <dt className="text-stone-400">Área:</dt>
                    <dd className="font-medium text-stone-800">
                      {formatArea(area.areaM2)}
                    </dd>
                  </div>
                  <div className="flex gap-1">
                    <dt className="text-stone-400">Perímetro:</dt>
                    <dd className="font-medium text-stone-800">
                      {formatDistance(area.perimeterM)}
                    </dd>
                  </div>
                </dl>

                {area.description && isSelected && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-stone-600">
                    {area.description}
                  </p>
                )}
              </button>

              {isSelected && (
                <div className="mt-3 flex gap-2 border-t border-emerald-200 pt-3">
                  <button
                    type="button"
                    onClick={() => onEdit(area.id)}
                    disabled={isBusy}
                    className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(area.id)}
                    disabled={isBusy}
                    className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {isBusy ? "Excluindo…" : "Excluir"}
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
