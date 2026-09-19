"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";

import { createArea, deleteArea, updateArea } from "@/app/actions";
import AreaForm, { type AreaFormValues } from "@/app/components/area-form";
import AreaList from "@/app/components/area-list";
import LocationSearch from "@/app/components/location-search";
import type { MapFocus, MapMode } from "@/app/components/planting-map";
import type { PlantingAreaView } from "@/lib/areas";
import { distanceM, formatArea, type LatLngTuple } from "@/lib/geo";

// O Leaflet manipula o DOM diretamente e acessa `window` na importação, por
// isso o mapa só pode ser carregado no navegador.
const PlantingMap = dynamic(() => import("@/app/components/planting-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-stone-100 text-sm text-stone-500">
      Carregando mapa…
    </div>
  ),
});

/**
 * Distância mínima entre dois vértices consecutivos, em metros.
 *
 * Um duplo clique no mapa dispara dois eventos de clique praticamente no mesmo
 * ponto; ignorar cliques muito próximos evita vértices duplicados sem impedir
 * nenhum desenho legítimo.
 */
const MIN_VERTEX_DISTANCE_M = 1;

type Props = {
  areas: PlantingAreaView[];
};

export default function MapWorkspace({ areas }: Props) {
  const [mode, setMode] = useState<MapMode>("idle");
  const [draft, setDraft] = useState<LatLngTuple[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Cada pedido de reposicionamento recebe um número crescente para que o mapa
  // reaja mesmo quando o destino é igual ao anterior.
  const focusToken = useRef(0);
  const [focus, setFocus] = useState<(MapFocus & { token: number }) | null>(
    null,
  );

  const editingArea = useMemo(
    () => areas.find((area) => area.id === editingId) ?? null,
    [areas, editingId],
  );

  const totalArea = useMemo(
    () => areas.reduce((sum, area) => sum + area.areaM2, 0),
    [areas],
  );

  function moveCamera(target: MapFocus) {
    focusToken.current += 1;
    setFocus({ ...target, token: focusToken.current });
  }

  function startDrawing() {
    setMode("drawing");
    setDraft([]);
    setEditingId(null);
    setSelectedId(null);
    setFormError(null);
  }

  function startEditing(id: string) {
    const area = areas.find((item) => item.id === id);
    if (!area) return;

    setMode("editing");
    setDraft(area.coordinates);
    setEditingId(id);
    setSelectedId(id);
    setFormError(null);
    moveCamera({ kind: "bounds", points: area.coordinates });
  }

  function cancelEditing() {
    setMode("idle");
    setDraft([]);
    setEditingId(null);
    setFormError(null);
  }

  function selectArea(id: string) {
    if (mode !== "idle") return;

    const area = areas.find((item) => item.id === id);
    if (!area) return;

    setSelectedId((current) => (current === id ? null : id));
    if (selectedId !== id && area.coordinates.length > 0) {
      moveCamera({ kind: "bounds", points: area.coordinates });
    }
  }

  function addVertex(point: LatLngTuple) {
    setDraft((current) => {
      const last = current.at(-1);
      if (last && distanceM(last, point) < MIN_VERTEX_DISTANCE_M) {
        return current;
      }
      return [...current, point];
    });
  }

  function moveVertex(index: number, point: LatLngTuple) {
    setDraft((current) =>
      current.map((vertex, i) => (i === index ? point : vertex)),
    );
  }

  function removeVertex(index: number) {
    setDraft((current) => current.filter((_, i) => i !== index));
  }

  function submit(values: AreaFormValues) {
    const input = {
      name: values.name,
      species: values.species,
      description: values.description,
      status: values.status,
      coordinates: draft,
    };

    setFormError(null);
    startTransition(async () => {
      const result = editingId
        ? await updateArea(editingId, input)
        : await createArea(input);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      setMode("idle");
      setDraft([]);
      setEditingId(null);
    });
  }

  function remove(id: string) {
    const area = areas.find((item) => item.id === id);
    if (!area) return;

    const confirmed = window.confirm(
      `Excluir a área “${area.name}”? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setBusyId(id);
    startTransition(async () => {
      const result = await deleteArea(id);
      setBusyId(null);

      if (!result.ok) {
        window.alert(result.error);
        return;
      }

      setSelectedId(null);
    });
  }

  const isDrawingOrEditing = mode !== "idle";

  return (
    <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
      <aside className="flex w-full flex-col gap-4 overflow-y-auto border-stone-200 bg-stone-50 p-4 lg:w-[380px] lg:border-r">
        {isDrawingOrEditing ? (
          <section className="flex flex-col gap-3">
            <header>
              <h2 className="text-sm font-semibold text-stone-900">
                {editingArea
                  ? `Editando “${editingArea.name}”`
                  : "Nova área de plantio"}
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Clique no mapa para marcar os vértices. Arraste um ponto para
                ajustá-lo ou clique sobre ele para removê-lo.
              </p>
            </header>

            <AreaForm
              // Recria o formulário ao trocar de área, descartando o que havia
              // sido digitado para o registro anterior.
              key={editingId ?? "new"}
              area={editingArea}
              draft={draft}
              pending={pending}
              error={formError}
              onSubmit={submit}
              onCancel={cancelEditing}
            />
          </section>
        ) : (
          <>
            <LocationSearch
              onPick={(center, zoom) => moveCamera({ kind: "point", center, zoom })}
            />

            <button
              type="button"
              onClick={startDrawing}
              className="rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800"
            >
              + Nova área
            </button>

            <section className="flex flex-col gap-3">
              <header className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-stone-900">
                  Áreas mapeadas
                </h2>
                <span className="text-xs text-stone-500">
                  {areas.length}{" "}
                  {areas.length === 1 ? "registro" : "registros"}
                </span>
              </header>

              {areas.length > 0 && (
                <p className="rounded-md bg-emerald-100 px-3 py-2 text-xs text-emerald-900">
                  Área total mapeada:{" "}
                  <strong className="font-semibold">
                    {formatArea(totalArea)}
                  </strong>
                </p>
              )}

              <AreaList
                areas={areas}
                selectedId={selectedId}
                busyId={busyId}
                onSelect={selectArea}
                onEdit={startEditing}
                onDelete={remove}
              />
            </section>
          </>
        )}
      </aside>

      <div className="relative min-h-[55vh] flex-1 lg:min-h-0">
        <PlantingMap
          areas={areas}
          selectedId={selectedId}
          mode={mode}
          draft={draft}
          focus={focus}
          onMapClick={addVertex}
          onVertexDrag={moveVertex}
          onVertexClick={removeVertex}
          onAreaClick={selectArea}
        />

        {isDrawingOrEditing && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full bg-stone-900/85 px-4 py-2 text-xs font-medium text-white shadow-lg">
            {draft.length < 3
              ? `Marque os vértices no mapa — ${3 - draft.length} ponto(s) restante(s)`
              : `${draft.length} vértices marcados · preencha os dados ao lado para salvar`}
          </div>
        )}
      </div>
    </div>
  );
}
