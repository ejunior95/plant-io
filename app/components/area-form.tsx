"use client";

import { useState } from "react";

import {
  AREA_STATUSES,
  STATUS_LABELS,
  type AreaStatus,
  type PlantingAreaView,
} from "@/lib/areas";
import {
  formatArea,
  formatDistance,
  polygonAreaM2,
  polygonPerimeterM,
  type LatLngTuple,
} from "@/lib/geo";

export type AreaFormValues = {
  name: string;
  species: string;
  description: string;
  status: AreaStatus;
};

type Props = {
  /** Área em edição; ausente quando se trata de um novo cadastro. */
  area: PlantingAreaView | null;
  draft: LatLngTuple[];
  pending: boolean;
  error: string | null;
  onSubmit: (values: AreaFormValues) => void;
  onCancel: () => void;
};

export default function AreaForm({
  area,
  draft,
  pending,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [values, setValues] = useState<AreaFormValues>({
    name: area?.name ?? "",
    species: area?.species ?? "",
    description: area?.description ?? "",
    status: area?.status ?? "PLANEJADA",
  });

  // As medidas acompanham o desenho em tempo real: ao arrastar um vértice, o
  // usuário vê imediatamente o efeito sobre a área.
  const areaM2 = polygonAreaM2(draft);
  const perimeterM = polygonPerimeterM(draft);
  const enoughPoints = draft.length >= 3;

  function update<K extends keyof AreaFormValues>(
    field: K,
    value: AreaFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
    >
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Measure label="Vértices" value={String(draft.length)} />
          <Measure label="Área" value={enoughPoints ? formatArea(areaM2) : "—"} />
          <Measure
            label="Perímetro"
            value={enoughPoints ? formatDistance(perimeterM) : "—"}
          />
        </div>
        {!enoughPoints && (
          <p className="mt-2 text-xs text-emerald-800">
            Clique no mapa para marcar os cantos da área. São necessários ao
            menos 3 pontos.
          </p>
        )}
      </div>

      <Field label="Nome da área" required>
        <input
          className={inputClass}
          value={values.name}
          onChange={(event) => update("name", event.target.value)}
          placeholder="Talhão 1 — encosta norte"
          maxLength={120}
          required
          autoFocus
        />
      </Field>

      <Field label="Espécie / cultura">
        <input
          className={inputClass}
          value={values.species}
          onChange={(event) => update("species", event.target.value)}
          placeholder="Ipê-amarelo, eucalipto…"
          maxLength={120}
        />
      </Field>

      <Field label="Situação">
        <select
          className={inputClass}
          value={values.status}
          onChange={(event) => update("status", event.target.value as AreaStatus)}
        >
          {AREA_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Observações">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={values.description}
          onChange={(event) => update("description", event.target.value)}
          placeholder="Tipo de solo, espaçamento, data prevista de plantio…"
          maxLength={1000}
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !enoughPoints}
          className="flex-1 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {pending ? "Salvando…" : area ? "Salvar alterações" : "Cadastrar área"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-emerald-700">
        {label}
      </p>
      <p className="text-sm font-semibold text-emerald-950">{value}</p>
    </div>
  );
}
