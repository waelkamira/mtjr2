"use client";

import { useEffect, useRef } from "react";
import type { CircleMarker, Map as LeafletMap } from "leaflet";

export type ProductCoordinates = { latitude: number; longitude: number };

type Props = {
  value: ProductCoordinates | null;
  onChange?: (coordinates: ProductCoordinates) => void;
  readOnly?: boolean;
  label: string;
  focus?: { coordinates: ProductCoordinates; zoom: number; key: string } | null;
};

const defaultCenter: ProductCoordinates = { latitude: 33.5138, longitude: 36.2765 };

export default function ProductLocationMap({ value, onChange, readOnly = false, label, focus = null }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const focusRef = useRef(focus);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { focusRef.current = focus; }, [focus]);

  useEffect(() => {
    let active = true;
    let clickHandler: ((event: { latlng: { lat: number; lng: number } }) => void) | undefined;

    void import("leaflet").then((leaflet) => {
      if (!active || !elementRef.current) return;
      const center = valueRef.current ?? defaultCenter;
      const map = leaflet.map(elementRef.current, { scrollWheelZoom: false, zoomControl: false, keyboard: true, preferCanvas: true })
        .setView([center.latitude, center.longitude], valueRef.current ? 13 : 6);
      leaflet.control.zoom({ position: "topright" }).addTo(map);
      leaflet.control.scale({ position: "bottomleft", metric: true, imperial: false, maxWidth: 120 }).addTo(map);
      leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        minZoom: 3,
        maxZoom: 19,
        updateWhenIdle: true,
        keepBuffer: 3,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      mapRef.current = map;
      if (focusRef.current) {
        const target = focusRef.current;
        map.flyTo([target.coordinates.latitude, target.coordinates.longitude], target.zoom, { duration: 0.8 });
      }

      if (valueRef.current) {
        markerRef.current = leaflet.circleMarker(
          [valueRef.current.latitude, valueRef.current.longitude],
          { radius: 8, color: "#b94708", weight: 2, fillColor: "#f0660d", fillOpacity: 0.85 }
        ).addTo(map);
      }
      if (!readOnly) {
        clickHandler = (event) => {
          onChangeRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
        };
        map.on("click", clickHandler);
      }
      window.setTimeout(() => map.invalidateSize(), 0);
    }).catch((cause: unknown) => {
      console.error("Product map could not be initialized.", cause);
    });

    return () => {
      active = false;
      if (mapRef.current) {
        if (clickHandler) mapRef.current.off("click", clickHandler);
        mapRef.current.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.coordinates.latitude, focus.coordinates.longitude], focus.zoom, { duration: 0.8 });
  }, [focus?.key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) markerRef.current.setLatLng([value.latitude, value.longitude]);
    else {
      void import("leaflet").then((leaflet) => {
        if (mapRef.current !== map || markerRef.current) return;
        markerRef.current = leaflet.circleMarker(
          [value.latitude, value.longitude],
          { radius: 8, color: "#b94708", weight: 2, fillColor: "#f0660d", fillOpacity: 0.85 }
        ).addTo(map);
      });
    }
  }, [value?.latitude, value?.longitude, value]);

  return <div className="product-location-map relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] shadow-sm">
    <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full border border-white/70 bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm">انقر على الخريطة لتحديد الموقع</div>
    <div ref={elementRef} role="application" aria-label={label} className="h-80 w-full sm:h-[22rem]" />
  </div>;
}
