"use client";

import { useEffect, useRef, useState } from "react";

type Coordinates = { latitude: number; longitude: number };
type LeafletPoint = { lat: number; lng: number };
type LeafletEvent = { latlng: LeafletPoint };
type LeafletMarker = {
  setLatLng(point: [number, number]): LeafletMarker;
  on(event: string, handler: (event: { target: { getLatLng(): LeafletPoint } }) => void): LeafletMarker;
  off(event: string, handler: (event: { target: { getLatLng(): LeafletPoint } }) => void): LeafletMarker;
  addTo(map: LeafletMap): LeafletMarker;
};
type LeafletMap = {
  setView(point: [number, number], zoom: number): LeafletMap;
  flyTo(point: [number, number], zoom: number, options?: { duration?: number }): LeafletMap;
  on(event: string, handler: (event: LeafletEvent) => void): LeafletMap;
  off(event: string, handler: (event: LeafletEvent) => void): LeafletMap;
  remove(): void;
  invalidateSize(): void;
};
type LeafletApi = {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options: Record<string, unknown>): { addTo(map: LeafletMap): unknown };
  divIcon(options: Record<string, unknown>): unknown;
  marker(point: [number, number], options: Record<string, unknown>): LeafletMarker;
};
type Props = {
  value?: Coordinates | null;
  focus?: (Coordinates & { zoom: number }) | null;
  onChange: (value: Coordinates) => void;
  height?: number;
  locale?: string;
};

const SYRIA_CENTER: [number, number] = [34.8, 38.9];

export default function LeafletLocationMap({ value, focus, onChange, height = 340, locale = "ar" }: Props) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const locationRef = useRef({ value, focus });
  const [leaflet, setLeaflet] = useState<LeafletApi | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { locationRef.current = { value, focus }; }, [value, focus]);

  useEffect(() => {
    let active = true;
    import("leaflet")
      .then((module) => {
        if (active) setLeaflet((module.default ?? module) as unknown as LeafletApi);
      })
      .catch(() => {
        if (active) setMapError(locale === "ar" ? "تعذّر تحميل مكتبة الخريطة." : "The map library could not be loaded.");
      });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    if (!leaflet || !elementRef.current || mapRef.current) return;
    const L = leaflet;
    const map = L.map(elementRef.current, {
      center: SYRIA_CENTER,
      zoom: 6,
      minZoom: 5,
      maxZoom: 19,
      zoomControl: true,
      scrollWheelZoom: false,
      preferCanvas: true
    });
    const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION
      || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
    L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(map);

    const icon = L.divIcon({
      className: "mtjr-leaflet-marker",
      html: '<span class="mtjr-leaflet-marker__pin"><span></span></span>',
      iconSize: [34, 42],
      iconAnchor: [17, 40]
    });
    const setMarker = (point: Coordinates, shouldFly: boolean, zoom = 15) => {
      const latLng: [number, number] = [point.latitude, point.longitude];
      if (!markerRef.current) {
        markerRef.current = L.marker(latLng, { icon, draggable: true }).addTo(map);
        markerRef.current.on("dragend", (event) => {
          const position = event.target.getLatLng();
          onChangeRef.current({ latitude: position.lat, longitude: position.lng });
        });
      } else {
        markerRef.current.setLatLng(latLng);
      }
      if (shouldFly) map.flyTo(latLng, zoom, { duration: 0.8 });
    };
    const clickHandler = (event: LeafletEvent) => {
      const point = { latitude: event.latlng.lat, longitude: event.latlng.lng };
      setMarker(point, false);
      onChangeRef.current(point);
    };
    map.on("click", clickHandler);
    mapRef.current = map;
    const resize = () => map.invalidateSize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (observer && elementRef.current) observer.observe(elementRef.current);
    const resizeTimer = window.setTimeout(resize, 150);
    return () => {
      window.clearTimeout(resizeTimer);
      observer?.disconnect();
      map.off("click", clickHandler);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map instance is deliberately created once per bundled Leaflet module load.
  }, [leaflet]);

  useEffect(() => {
    if (!leaflet || !mapRef.current) return;
    const L = leaflet;
    const { value: currentValue, focus: currentFocus } = locationRef.current;
    const point = currentFocus ?? currentValue;
    if (!point) return;
    const position: [number, number] = [point.latitude, point.longitude];
    if (currentValue) {
      if (!markerRef.current) {
        const icon = L.divIcon({
          className: "mtjr-leaflet-marker",
          html: '<span class="mtjr-leaflet-marker__pin"><span></span></span>',
          iconSize: [34, 42],
          iconAnchor: [17, 40]
        });
        markerRef.current = L.marker(position, { icon, draggable: true }).addTo(mapRef.current);
        markerRef.current.on("dragend", (event) => {
          const current = event.target.getLatLng();
          onChangeRef.current({ latitude: current.lat, longitude: current.lng });
        });
      } else markerRef.current.setLatLng(position);
    }
    mapRef.current.flyTo(position, currentFocus?.zoom ?? 14, { duration: 0.8 });
  }, [leaflet, focus?.latitude, focus?.longitude, focus?.zoom, value?.latitude, value?.longitude]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="relative">
        <div ref={elementRef} style={{ height }} className="z-0 w-full bg-slate-100" role="application" aria-label={locale === "ar" ? "خريطة تحديد موقع المنتج" : "Product location map"} />
        {!leaflet && !mapError && <div className="absolute inset-0 grid place-items-center bg-slate-100/90 text-sm text-slate-600">{locale === "ar" ? "جارٍ تحميل الخريطة…" : "Loading map…"}</div>}
        {mapError && <div role="alert" className="absolute inset-0 grid place-items-center bg-white/95 p-5 text-center text-sm text-red-700">{mapError}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
        <span>{locale === "ar" ? "انقر على الخريطة أو اسحب الدبوس لتحديد الموقع بدقة." : "Click the map or drag the pin to set the exact location."}</span>
        <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer" className="font-medium underline">{locale === "ar" ? "الإبلاغ عن خطأ بالخريطة" : "Report a map issue"}</a>
      </div>
    </section>
  );
}
