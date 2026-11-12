"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LeafletLocationMap from "@/components/maps/leaflet-location-map";
import { SellerIcon } from "@/features/seller/seller-navigation";
import { translate, type Locale } from "@/lib/locale";

type GeoItem = {
  id: string;
  nameAr: string | null;
  nameEn: string;
  latitude: number | null;
  longitude: number | null;
  kind?: string | null;
};
type GeoResponse = { items: GeoItem[]; pagination: { total: number; totalPages: number } };

function locationError(cause: unknown, locale: Locale, english: string, arabic: string) {
  const message = cause instanceof Error ? cause.message : "";
  return /[\u0600-\u06FF]/.test(message) ? message : translate(locale, english, arabic);
}
type MapSearchResult = { id: string; label: string; latitude: number; longitude: number; type: string };
type LocationValue = {
  governorate?: string;
  district?: string;
  subdistrict?: string;
  city?: string;
  localityId?: string;
  neighborhood?: string;
  streetAddress?: string;
  latitude?: number;
  longitude?: number;
};
type Props = {
  locale: Locale;
  title?: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

async function loadLevel(level: string, params: Record<string, string> = {}): Promise<GeoResponse> {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/geography/${level}?${query.toString()}`, { cache: "no-store" });
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("The geography service returned an invalid response."); }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error : "Unable to load Syrian locations.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || !("items" in payload) || !Array.isArray(payload.items)) {
    throw new Error("The geography service returned an unexpected data format.");
  }
  return payload as GeoResponse;
}

async function loadAllLevel(level: string, params: Record<string, string> = {}): Promise<GeoResponse> {
  const first = await loadLevel(level, { ...params, page: "1", limit: "100" });
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page += 1) {
    const result = await loadLevel(level, { ...params, page: String(page), limit: "100" });
    items.push(...result.items);
  }
  return { ...first, items, pagination: { ...first.pagination, totalPages: 1 } };
}

export default function SyriaLocationPicker({ locale, title, value, onChange }: Props) {
  const ar = locale === "ar";
  const [governorates, setGovernorates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [subdistricts, setSubdistricts] = useState<GeoItem[]>([]);
  const [localities, setLocalities] = useState<GeoItem[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [localityQuery, setLocalityQuery] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [mapSearchResults, setMapSearchResults] = useState<MapSearchResult[]>([]);
  const [mapSearchBusy, setMapSearchBusy] = useState(false);
  const [mapSearchError, setMapSearchError] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; zoom: number } | null>(null);
  const selectionRequest = useRef(0);
  const hydratedLocalityId = useRef("");
  const labels = useMemo(() => ({
    governorate: translate(locale, "Governorate", "المحافظة"),
    district: translate(locale, "District", "المنطقة"),
    subdistrict: translate(locale, "Subdistrict", "الناحية"),
    locality: translate(locale, "City / town / village", "المدينة / البلدة / القرية"),
    neighborhood: translate(locale, "Neighbourhood (local name)", "الحي (الاسم المحلي)"),
    choose: translate(locale, "Choose", "اختر"),
    search: translate(locale, "Search places", "ابحث عن تجمع سكاني"),
    searchButton: translate(locale, "Search", "بحث"),
    loading: translate(locale, "Loading locations…", "جارٍ تحميل المواقع…"),
    mapSearch: translate(locale, "Search OpenSyria governorates, districts, subdistricts and localities", "ابحث في بيانات OpenSyria عن المحافظات والمناطق والنواحي والتجمعات السكانية"),
    mapSearchButton: translate(locale, "Find on map", "ابحث على الخريطة"),
    currentLocation: translate(locale, "Use my current location", "استخدم موقعي الحالي"),
    searching: translate(locale, "Searching the map…", "جارٍ البحث على الخريطة…")
  }), [locale]);

  useEffect(() => {
    let active = true;
    loadLevel("governorates").then((result) => { if (active) setGovernorates(result.items); })
      .catch((cause) => { if (active) setError(locationError(cause, locale, "Unable to load governorates.", "تعذّر تحميل المحافظات.")); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const localityId = value.localityId;
    if (!localityId) {
      hydratedLocalityId.current = "";
      return;
    }
    if (localityId === hydratedLocalityId.current) return;
    hydratedLocalityId.current = localityId;
    let active = true;
    void Promise.resolve().then(async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/geography/localities/${encodeURIComponent(localityId)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load the selected locality.");
        const locality = payload.item as GeoItem & {
          governorateId: string; districtId: string | null; subdistrictId: string | null;
        };
        const [districtResult, subdistrictResult, localityResult] = await Promise.all([
          loadAllLevel("districts", { governorateId: locality.governorateId }),
          locality.districtId ? loadAllLevel("subdistricts", { districtId: locality.districtId }) : Promise.resolve({ items: [], pagination: { total: 0, totalPages: 0 } }),
          loadAllLevel("localities", {
            ...(locality.districtId ? { districtId: locality.districtId } : { governorateId: locality.governorateId }),
            ...(locality.subdistrictId ? { subdistrictId: locality.subdistrictId } : {}),
            limit: "100"
          })
        ]);
        if (!active) return;
        setGovernorateId(locality.governorateId);
        setDistrictId(locality.districtId ?? "");
        setSubdistrictId(locality.subdistrictId ?? "");
        setDistricts(districtResult.items);
        setSubdistricts(subdistrictResult.items);
        setLocalities(localityResult.items.some((item) => item.id === locality.id)
          ? localityResult.items
          : [locality, ...localityResult.items]);
        const coordinates = locality.latitude != null && locality.longitude != null
          ? { latitude: locality.latitude, longitude: locality.longitude }
          : value.latitude !== undefined && value.longitude !== undefined
            ? { latitude: value.latitude, longitude: value.longitude }
            : null;
        if (coordinates) setFocus({ ...coordinates, zoom: 15 });
      } catch (cause) {
        if (active) setError(locationError(cause, locale, "Unable to load the selected locality.", "تعذّر تحميل التجمع السكاني المحدد."));
      } finally {
        if (active) setBusy(false);
      }
    });
    return () => { active = false; };
  }, [value.localityId, value.latitude, value.longitude]);

  async function chooseGovernorate(id: string) {
    const request = ++selectionRequest.current;
    setGovernorateId(id); setDistrictId(""); setSubdistrictId(""); setDistricts([]); setSubdistricts([]); setLocalities([]); 
    const item = governorates.find((entry) => entry.id === id);
    onChange({
      governorate: item ? name(item) : undefined,
      district: undefined, subdistrict: undefined, city: undefined, localityId: undefined,
      neighborhood: undefined, streetAddress: undefined, latitude: undefined, longitude: undefined
    });
    if (item?.latitude != null && item.longitude != null) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 7 }); else setFocus(null);
    setError("");
    if (!id) { setBusy(false); return; }
    setBusy(true);
    try {
      const districtResult = await loadAllLevel("districts", { governorateId: id });
      if (request === selectionRequest.current) {
        setDistricts(districtResult.items);
      }
    } catch (cause) { if (request === selectionRequest.current) setError(locationError(cause, locale, "Unable to load districts.", "تعذّر تحميل المناطق.")); }
    finally { if (request === selectionRequest.current) setBusy(false); }
  }

  async function chooseDistrict(id: string) {
    const request = ++selectionRequest.current;
    setDistrictId(id); setSubdistrictId(""); setSubdistricts([]); setLocalities([]); 
    const item = districts.find((entry) => entry.id === id);
    const selectedGovernorate = governorates.find((entry) => entry.id === governorateId);
    onChange({
      governorate: selectedGovernorate ? name(selectedGovernorate) : value.governorate,
      district: item ? name(item) : undefined,
      subdistrict: undefined, city: undefined, localityId: undefined,
      neighborhood: undefined, streetAddress: undefined, latitude: undefined, longitude: undefined
    });
    if (item?.latitude != null && item.longitude != null) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 10 }); else setFocus(null);
    setError("");
    if (!id) { setBusy(false); return; }
    setBusy(true);
    try {
      const [subdistrictResult, localityResult] = await Promise.all([
        loadAllLevel("subdistricts", { districtId: id }),
        loadAllLevel("localities", { districtId: id })
      ]);
      if (request === selectionRequest.current) {
        setSubdistricts(subdistrictResult.items);
        setLocalities(localityResult.items);
      }
    } catch (cause) { if (request === selectionRequest.current) setError(locationError(cause, locale, "Unable to load subdistricts.", "تعذّر تحميل النواحي.")); }
    finally { if (request === selectionRequest.current) setBusy(false); }
  }

  async function chooseSubdistrict(id: string) {
    const request = ++selectionRequest.current;
    setSubdistrictId(id); setLocalities([]); 
    const item = subdistricts.find((entry) => entry.id === id);
    const selectedDistrict = districts.find((entry) => entry.id === districtId);
    const selectedGovernorate = governorates.find((entry) => entry.id === governorateId);
    onChange({
      governorate: selectedGovernorate ? name(selectedGovernorate) : value.governorate,
      district: selectedDistrict ? name(selectedDistrict) : value.district,
      subdistrict: item ? name(item) : undefined,
      city: undefined, localityId: undefined, neighborhood: undefined, streetAddress: undefined,
      latitude: undefined, longitude: undefined
    });
    if (item?.latitude != null && item.longitude != null) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 12 }); else setFocus(null);
    setError("");
    if (!id) { setBusy(false); return; }
    setBusy(true);
    try { const result = await loadAllLevel("localities", { districtId, subdistrictId: id }); if (request === selectionRequest.current) setLocalities(result.items); }
    catch (cause) { if (request === selectionRequest.current) setError(locationError(cause, locale, "Unable to load localities.", "تعذّر تحميل التجمعات السكانية.")); }
    finally { if (request === selectionRequest.current) setBusy(false); }
  }

  async function searchLocalities() {
    if (!districtId || !localityQuery.trim()) return;
    setBusy(true); setError("");
    try { setLocalities((await loadAllLevel("localities", { districtId, ...(subdistrictId ? { subdistrictId } : {}), q: localityQuery.trim() })).items); }
    catch (cause) { setError(locationError(cause, locale, "Unable to search localities.", "تعذّر البحث عن التجمعات السكانية.")); }
    finally { setBusy(false); }
  }

  function chooseLocality(id: string) {
    const item = localities.find((entry) => entry.id === id);
    const hasCoordinates = Boolean(item && item.latitude !== null && item.longitude !== null);
    const selectedDistrict = districts.find((entry) => entry.id === districtId);
    const selectedGovernorate = governorates.find((entry) => entry.id === governorateId);
    const selectedSubdistrict = subdistricts.find((entry) => entry.id === subdistrictId);
    onChange({
      governorate: selectedGovernorate ? name(selectedGovernorate) : value.governorate,
      district: selectedDistrict ? name(selectedDistrict) : value.district,
      subdistrict: selectedSubdistrict ? name(selectedSubdistrict) : undefined,
      city: item ? name(item) : undefined,
      localityId: id || undefined,
      ...(hasCoordinates ? { latitude: item!.latitude!, longitude: item!.longitude! } : {})
    });
    if (hasCoordinates) setFocus({ latitude: item!.latitude!, longitude: item!.longitude!, zoom: 15 });
  }

  async function searchMapPlaces() {
    const query = mapSearchQuery.trim();
    if (query.length < 3) {
      setMapSearchError(translate(locale, "Enter at least 3 characters.", "أدخل ثلاثة أحرف على الأقل."));
      setMapSearchResults([]);
      return;
    }
    setMapSearchBusy(true);
    setMapSearchError("");
    try {
      const response = await fetch(`/api/geography/search?q=${encodeURIComponent(query)}&locale=${locale}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Map search failed.");
      const results = Array.isArray(payload.items) ? payload.items as MapSearchResult[] : [];
      setMapSearchResults(results);
      if (!results.length) setMapSearchError(translate(locale, "No matching OpenSyria places found. Try another city, town or village name.", "لم نعثر على موقع مطابق في OpenSyria. جرّب اسم مدينة أو بلدة أو قرية أخرى."));
    } catch {
      setMapSearchError(translate(locale, "Could not search the map right now. Please try again.", "تعذّر البحث على الخريطة حالياً. حاول مرة أخرى."));
      setMapSearchResults([]);
    } finally {
      setMapSearchBusy(false);
    }
  }

  function selectMapSearchResult(result: MapSearchResult) {
    setMapSearchQuery(result.label);
    setMapSearchResults([]);
    setMapSearchError("");
    updateCoordinates({ latitude: result.latitude, longitude: result.longitude });
  }

  function useCurrentLocation() {
    setMapSearchError("");
    if (!navigator.geolocation) {
      setMapSearchError(translate(locale, "Your browser does not support location access.", "متصفحك لا يدعم تحديد الموقع."));
      return;
    }
    setMapSearchBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setMapSearchQuery(translate(locale, "Current location", "موقعي الحالي"));
        setMapSearchResults([]);
        setMapSearchBusy(false);
      },
      () => {
        setMapSearchError(translate(locale, "Location access was denied or unavailable. You can search for a place instead.", "تعذّر الوصول إلى موقعك أو لم تسمح للمتصفح بذلك. يمكنك البحث عن المكان بدلاً من ذلك."));
        setMapSearchBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function updateCoordinates(coords: { latitude: number; longitude: number }) {
    onChange({ ...value, ...coords });
    setFocus({ ...coords, zoom: 15 });
  }

  function focusNeighborhoodOnMap() {
    const neighborhood = value.neighborhood?.trim();
    if (!neighborhood || value.latitude === undefined || value.longitude === undefined) return;
    // Neighborhood names are seller-entered; zoom to the selected locality/pin
    // rather than pretending an unverified neighborhood centroid exists.
    setFocus({ latitude: value.latitude, longitude: value.longitude, zoom: 16 });
  }

  const fieldClass = "mt-1.5 w-full rounded-xl border border-[#eee9e4] bg-white px-3.5 py-3 text-sm text-[#454545] shadow-sm outline-none transition placeholder:text-[#918a84] focus:border-[#FF8C1C] focus:ring-4 focus:ring-[#FF8C1C]/10 disabled:cursor-not-allowed disabled:opacity-50";
  const name = (item: GeoItem) => item.nameAr || item.nameEn;
  const kindLabel = (kind?: string | null) => {
    if (!kind) return "";
    if (!ar) return kind;
    return ({ city: "مدينة", town: "بلدة", village: "قرية", locality: "تجمع سكاني", district: "منطقة", subdistrict: "ناحية", governorate: "محافظة" } as Record<string, string>)[kind] ?? "موقع";
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[#eee9e4] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fff1e8] text-[#e8750b]"><SellerIcon name="pin" /></span>
        <div><h3 className="font-extrabold text-[#454545]">{title ?? translate(locale, "Product location in Syria", "موقع المنتج في سوريا")}</h3>
        <p className="mt-1 text-xs leading-6 text-[#77716c]">{translate(locale, "Choose the administrative area from largest to smallest. The map follows each selection.", "اختر الموقع بالتسلسل الإداري من الأكبر إلى الأصغر، وستنتقل الخريطة تلقائياً مع كل اختيار.")}</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">{labels.governorate}
          <select className={fieldClass} value={governorateId} onChange={(event) => void chooseGovernorate(event.target.value)}>
            <option value="">{governorates.length ? labels.choose : translate(locale, "No governorates loaded", "لم يتم تحميل المحافظات")}</option>
            {governorates.map((item) => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{labels.district}
          <select className={fieldClass} value={districtId} disabled={!governorateId || busy} onChange={(event) => void chooseDistrict(event.target.value)}>
            <option value="">{!governorateId ? labels.choose : districts.length ? labels.choose : translate(locale, "No districts found", "لا توجد مناطق مسجلة لهذه المحافظة")}</option>
            {districts.map((item) => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{labels.subdistrict}
          <select className={fieldClass} value={subdistrictId} disabled={!districtId || busy} onChange={(event) => void chooseSubdistrict(event.target.value)}>
            <option value="">{!districtId ? labels.choose : subdistricts.length ? labels.choose : translate(locale, "No subdistricts found", "لا توجد نواحٍ مسجلة لهذه المنطقة")}</option>
            {subdistricts.map((item) => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{labels.locality}
          <select className={fieldClass} value={value.localityId ?? ""} disabled={!districtId || busy} onChange={(event) => chooseLocality(event.target.value)}>
            <option value="">{!districtId ? labels.choose : localities.length ? labels.choose : translate(locale, "No localities found", "لا توجد مدن أو بلدات أو قرى مسجلة لهذا الاختيار")}</option>
            {localities.map((item) => <option key={item.id} value={item.id}>{name(item)}{item.kind ? ` · ${kindLabel(item.kind)}` : ""}</option>)}
          </select>
        </label>
      </div>
      {districtId && <div className="flex gap-2">
        <input className={fieldClass + " mt-0 min-w-0"} value={localityQuery} onChange={(event) => setLocalityQuery(event.target.value)} placeholder={labels.search} />
        <button type="button" onClick={() => void searchLocalities()} disabled={busy || !localityQuery.trim()} className="shrink-0 rounded-xl bg-[#FF8C1C] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#E8750B] disabled:cursor-not-allowed disabled:opacity-50">{labels.searchButton}</button>
      </div>}
      <label className="block text-sm font-medium">{labels.neighborhood}
        <input className={fieldClass} value={value.neighborhood ?? ""} maxLength={120} onChange={(event) => onChange({ ...value, neighborhood: event.target.value || undefined })} onBlur={focusNeighborhoodOnMap} placeholder={translate(locale, "e.g. Al-Mazzeh, Abu Rummaneh", "مثال: المزة، أبو رمانة")} />
        <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted)]">{translate(locale, "OpenSyria does not publish a verified neighbourhood directory. Enter the local neighbourhood name here; the administrative selections above remain sourced from OpenSyria.", "لا تنشر OpenSyria دليلاً موثقاً مستقلاً للأحياء. اكتب اسم الحي هنا، أما التقسيمات الإدارية أعلاه فمصدرها OpenSyria حصراً.")}</span>
      </label>
      <label className="block text-sm font-medium">{translate(locale, "Exact street address", "العنوان الدقيق")}
        <input className={fieldClass} value={value.streetAddress ?? ""} maxLength={500} onChange={(event) => onChange({ ...value, streetAddress: event.target.value || undefined })} placeholder={translate(locale, "Street, building, floor, landmark…", "الشارع، البناء، الطابق، علامة مميزة…")} />
        <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted)]">{translate(locale, "Enter the exact address manually, then place the pin as accurately as possible. This is seller-provided information, not an OpenSyria administrative field.", "اكتب العنوان الدقيق يدوياً ثم ضع دبوس الخريطة في موقعه الصحيح. هذه معلومة يدخلها البائع وليست حقلاً إدارياً من OpenSyria.")}</span>
      </label>
      {busy && <p role="status" className="text-xs text-[var(--muted)]">{labels.loading}</p>}
      {!busy && !error && governorates.length === 0 && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{translate(locale, "No Syrian geography records are available in this database. Run npm run db:sync-syria-geography to import the official dataset.", "لا توجد بيانات جغرافية سورية في قاعدة البيانات. نفّذ الأمر npm run db:sync-syria-geography لاستيراد البيانات الرسمية.")}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div role="search" className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="seller-map-place-search">{translate(locale, "Find a place on the map", "ابحث عن موقع على الخريطة")}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="seller-map-place-search" className={fieldClass + " mt-0 min-w-0 flex-1"} value={mapSearchQuery} onChange={(event) => { setMapSearchQuery(event.target.value); setMapSearchError(""); setMapSearchResults([]); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchMapPlaces(); } }} placeholder={labels.mapSearch} maxLength={160} />
          <button type="button" onClick={() => void searchMapPlaces()} disabled={mapSearchBusy || mapSearchQuery.trim().length < 3} className="rounded-xl bg-[#FF8C1C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#E8750B] disabled:cursor-not-allowed disabled:opacity-50">{mapSearchBusy ? labels.searching : labels.mapSearchButton}</button>
          <button type="button" onClick={useCurrentLocation} disabled={mapSearchBusy} className="rounded-xl border border-[#eee9e4] bg-white px-4 py-3 text-sm font-semibold text-[#454545] transition hover:border-[#FF8C1C] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{labels.currentLocation}</button>
        </div>
        {mapSearchError && <p role="status" className="text-xs text-amber-700">{mapSearchError}</p>}
        {mapSearchResults.length > 0 && <ul className="max-h-56 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]" aria-label={translate(locale, "Map search results", "نتائج البحث على الخريطة")}>
          {mapSearchResults.map((result) => <li key={result.id}>
            <button type="button" onClick={() => selectMapSearchResult(result)} className="w-full px-3 py-3 text-start text-sm transition hover:bg-[#fff1e8] focus:bg-[#fff1e8]">
              <span className="block font-medium text-[var(--color-ink-900)]">{result.label}</span>
              {result.type && <span className="mt-1 block text-xs text-[var(--muted)]">{kindLabel(result.type)}</span>}
            </button>
          </li>)}
        </ul>}
        <p className="text-xs leading-5 text-[var(--muted)]">{translate(locale, "Search official OpenSyria places, then fine-tune the exact address by dragging the map pin.", "ابحث عن المواقع المنشورة في OpenSyria، ثم حدد العنوان الدقيق بتحريك دبوس الخريطة.")}</p>
      </div>
      <LeafletLocationMap
        locale={locale}
        value={value.latitude !== undefined && value.longitude !== undefined ? { latitude: value.latitude, longitude: value.longitude } : null}
        focus={focus}
        onChange={updateCoordinates}
        height={320}
      />
      {value.latitude !== undefined && value.longitude !== undefined && (
        <p className="text-xs tabular-nums text-[var(--muted)]">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</p>
      )}
    </section>
  );
}
