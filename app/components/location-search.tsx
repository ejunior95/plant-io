"use client";

import { useState } from "react";

import type { GeocodeResult } from "@/app/api/geocode/route";
import type { LatLngTuple } from "@/lib/geo";

type Props = {
  onPick: (point: LatLngTuple, zoom: number) => void;
};

/** Leva o mapa até um endereço pesquisado ou até a posição do dispositivo. */
export default function LocationSearch({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">(
    "idle",
  );

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;

    setStatus("loading");
    setResults([]);

    try {
      const response = await fetch(
        `/api/geocode?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setResults(data.results);
      setStatus(data.results.length === 0 ? "empty" : "idle");
    } catch {
      setStatus("error");
    }
  }

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }

    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus("idle");
        setResults([]);
        onPick([position.coords.latitude, position.coords.longitude], 17);
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={search} className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar município, sítio, endereço…"
          aria-label="Buscar local no mapa"
        />
        <button
          type="submit"
          disabled={status === "loading" || query.trim().length < 3}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-50"
        >
          {status === "loading" ? "…" : "Buscar"}
        </button>
        <button
          type="button"
          onClick={useCurrentPosition}
          title="Centralizar na minha localização"
          aria-label="Centralizar na minha localização"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm transition hover:bg-stone-100"
        >
          ◎
        </button>
      </form>

      {status === "empty" && (
        <p className="text-xs text-stone-500">Nenhum local encontrado.</p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-600">
          Não foi possível buscar o local. Verifique a conexão e tente de novo.
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-stone-200 bg-white p-1">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onPick([result.lat, result.lng], 15);
                  setResults([]);
                  setQuery("");
                }}
                className="w-full rounded px-2 py-1.5 text-left text-xs text-stone-700 transition hover:bg-emerald-50"
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
