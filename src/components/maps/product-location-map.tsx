"use client";

import { useEffect, useRef, useState } from "react";

type Coordinates = { latitude: number; longitude: number };
type LeafletPoint = { lat: number; lng: number };
type MapInstance = {
  setView(point: [number, number], zoom: number): MapInstance;
  on(event: string, handler: () => void): MapInstance;
  off(event: string, handler: () => void): MapInstance;
  remove(): void;
  invalidateSize(): void;
};
type Marker = { addTo(map: MapInstance): Marker };
type LeafletApi = {
  map(element: HTMLElement, options?: Record<string, unknown>): MapInstance;
  tileLayer(url: string, options: Record<string, unknown>): { addTo(map: MapInstance): unknown };
  circleMarker(point: [number, number], options: Record<string, unknown>): Marker;
};

export default function ProductLocationMap({ value, locale = "ar" }: { value: Coordinates; locale?: string }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let active = true;
    let map: MapInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof window.setTimeout> | null = null;

    void import("leaflet").then((module) => {
      if (!active || !elementRef.current) return;
      const leaflet = (module.default ?? module) as unknown as LeafletApi;
      map = leaflet.map(elementRef.current, {
        center: [value.latitude, value.longitude],
        zoom: 13,
        minZoom: 5,
        maxZoom: 19,
        zoomControl: true,
        scrollWheelZoom: false,
        preferCanvas: true
      });
      leaflet.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION
            || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        }
      ).addTo(map);
      leaflet.circleMarker([value.latitude, value.longitude], {
        radius: 8,
        color: "#356b82",
        weight: 2,
        fillColor: "#69b5b0",
        fillOpacity: 0.9
      }).addTo(map);
      const resize = () => map?.invalidateSize();
      resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
      if (resizeObserver && elementRef.current) resizeObserver.observe(elementRef.current);
      resizeTimer = window.setTimeout(resize, 150);
    }).catch(() => {
      if (active) setMapError(true);
    });

    return () => {
      active = false;
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, [value.latitude, value.longitude]);

  const externalMapUrl = `https://www.openstreetmap.org/?mlat=${value.latitude}&mlon=${value.longitude}#map=14/${value.latitude}/${value.longitude}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className="text-sm font-semibold">{locale === "ar" ? "الموقع التقريبي على الخريطة" : "Approximate map location"}</h3>
        <a href={externalMapUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold underline">
          {locale === "ar" ? "فتح الخريطة" : "Open map"} ↗
        </a>
      </div>
      <div ref={elementRef} className="h-64 w-full bg-[var(--surface-soft)]" role="img" aria-label={locale === "ar" ? "خريطة الموقع التقريبي للعقار" : "Approximate property location map"} />
      {mapError && (
        <p role="status" className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
          {locale === "ar" ? "تعذّر تحميل الخريطة. يمكنك فتح الموقع في OpenStreetMap." : "The map could not load. You can open the location in OpenStreetMap."}
        </p>
      )}
      <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
        {locale === "ar" ? "يعرض المتجر موقعاً تقريبياً لحماية خصوصية العنوان الدقيق." : "An approximate location is shown to protect the exact address."}
      </p>
    </section>
  );
}
