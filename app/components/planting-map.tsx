"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { STATUS_COLORS, type PlantingAreaView } from "@/lib/areas";
import type { LatLngTuple } from "@/lib/geo";
import { BRAZIL_VIEW, type MapView } from "@/lib/map-view";

export type MapMode = "idle" | "drawing" | "editing";

/** Leva a câmera até o enquadramento pedido. */
function applyView(map: L.Map, view: MapView) {
  if (view.kind === "point") {
    map.setView(view.center, view.zoom);
    return;
  }

  if (view.points.length > 0) {
    map.fitBounds(L.latLngBounds(view.points), { padding: [48, 48] });
  }
}

type Props = {
  areas: PlantingAreaView[];
  selectedId: string | null;
  mode: MapMode;
  draft: LatLngTuple[];
  /** Onde o mapa abre. Lido apenas na criação; depois use `focus`. */
  initialView: MapView;
  /** Muda de identidade a cada pedido de reposicionamento da câmera. */
  focus: (MapView & { token: number }) | null;
  onMapClick: (point: LatLngTuple) => void;
  onVertexDrag: (index: number, point: LatLngTuple) => void;
  onVertexClick: (index: number) => void;
  onAreaClick: (id: string) => void;
};

export default function PlantingMap({
  areas,
  selectedId,
  mode,
  draft,
  initialView,
  focus,
  onMapClick,
  onVertexDrag,
  onVertexClick,
  onAreaClick,
}: Props) {
  // O Leaflet lê este valor só na criação do mapa. Guardá-lo em uma ref deixa
  // explícito que uma mudança posterior não recria o mapa, e mantém o efeito de
  // criação sem dependências.
  const initialViewRef = useRef(initialView);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const areaLayerRef = useRef<L.LayerGroup | null>(null);
  const draftLayerRef = useRef<L.LayerGroup | null>(null);

  // Os manipuladores do Leaflet são registrados uma única vez, mas precisam
  // enxergar sempre a última versão das funções e do estado. Guardá-los em uma
  // ref evita remover e recriar os listeners a cada renderização.
  const handlers = useRef({
    onMapClick,
    onVertexDrag,
    onVertexClick,
    onAreaClick,
    mode,
  });
  // A sincronização acontece em um efeito — escrever em uma ref durante a
  // renderização não é permitido. Por ser declarado antes dos demais efeitos,
  // este roda primeiro no mesmo commit, e os manipuladores do Leaflet só são
  // disparados por interação do usuário, já com os valores atualizados.
  useEffect(() => {
    handlers.current = {
      onMapClick,
      onVertexDrag,
      onVertexClick,
      onAreaClick,
      mode,
    };
  });

  // Cria o mapa. O array de dependências vazio é intencional: o Leaflet
  // controla o DOM do contêiner e não deve ser reinicializado.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: BRAZIL_VIEW.center,
      zoom: BRAZIL_VIEW.zoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Antes da camada de tiles, para que os primeiros blocos pedidos à rede já
    // sejam os da região certa em vez dos do Brasil inteiro.
    applyView(map, initialViewRef.current);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; colaboradores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on("click", (event: L.LeafletMouseEvent) => {
      if (handlers.current.mode === "idle") return;
      handlers.current.onMapClick([event.latlng.lat, event.latlng.lng]);
    });

    areaLayerRef.current = L.layerGroup().addTo(map);
    draftLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // O contêiner pode ter sido medido antes de o layout estabilizar. O
    // enquadramento por retângulo depende do tamanho real, então é refeito aqui.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      applyView(map, initialViewRef.current);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      areaLayerRef.current = null;
      draftLayerRef.current = null;
    };
  }, []);

  // Durante o desenho o duplo clique não deve aproximar o mapa: os dois
  // cliques já marcam vértices, e o zoom simultâneo desorienta o usuário.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (mode !== "idle") {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }

    const container = map.getContainer();
    container.style.cursor = mode === "idle" ? "" : "crosshair";
  }, [mode]);

  // Polígonos já salvos.
  useEffect(() => {
    const layer = areaLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    for (const area of areas) {
      if (area.coordinates.length < 3) continue;
      // A área em edição é representada pelo rascunho, não pela versão salva.
      if (mode === "editing" && area.id === selectedId) continue;

      const isSelected = area.id === selectedId;
      const color = STATUS_COLORS[area.status];

      const polygon = L.polygon(area.coordinates, {
        color,
        weight: isSelected ? 4 : 2,
        opacity: 1,
        fillColor: color,
        fillOpacity: isSelected ? 0.4 : 0.2,
        // Durante o desenho os polígonos não podem capturar o clique, senão
        // seria impossível colocar um vértice sobre uma área existente.
        interactive: mode === "idle",
      });

      polygon.bindTooltip(area.name, { sticky: true });
      polygon.on("click", (event) => {
        L.DomEvent.stop(event);
        handlers.current.onAreaClick(area.id);
      });

      polygon.addTo(layer);
    }
  }, [areas, selectedId, mode]);

  // Polígono em construção ou em edição, com alças nos vértices.
  useEffect(() => {
    const layer = draftLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    if (mode === "idle" || draft.length === 0) return;

    if (draft.length >= 3) {
      L.polygon(draft, {
        color: "#15803d",
        weight: 3,
        dashArray: "6 4",
        fillColor: "#22c55e",
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(layer);
    } else if (draft.length === 2) {
      L.polyline(draft, {
        color: "#15803d",
        weight: 3,
        dashArray: "6 4",
        interactive: false,
      }).addTo(layer);
    }

    draft.forEach((point, index) => {
      const isFirst = index === 0;
      const marker = L.marker(point, {
        draggable: true,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          html: `<span class="plantio-vertex${isFirst ? " plantio-vertex--first" : ""}"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        title: isFirst
          ? "Primeiro ponto — arraste para ajustar, clique para remover"
          : "Arraste para ajustar, clique para remover",
      });

      marker.on("drag", (event) => {
        const { lat, lng } = (event.target as L.Marker).getLatLng();
        handlers.current.onVertexDrag(index, [lat, lng]);
      });

      marker.on("click", (event) => {
        L.DomEvent.stop(event);
        handlers.current.onVertexClick(index);
      });

      marker.addTo(layer);
    });
  }, [draft, mode]);

  // Reposiciona a câmera quando o workspace pede foco em uma área ou local.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;

    applyView(map, focus);
  }, [focus]);

  return <div ref={containerRef} className="h-full w-full" />;
}
