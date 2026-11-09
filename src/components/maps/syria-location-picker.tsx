"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LeafletLocationMap from "@/components/maps/leaflet-location-map";
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
  return /[\\u0600-\\u06FF]/.test(message) ? message : translate(locale, english, arabic);
}
type NeighborhoodSuggestion = {
  id: string; nameAr: string; cityGroupNameAr: string; latitude: number; longitude: number;
  verificationStatus: "CANDIDATE" | "VERIFIED"; source: string; distanceKm: number;
};
type LocationValue = {
  city?: string;
  district?: string;
  localityId?: string;
  neighborhoodId?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
};
type Props = {
  locale: Locale;
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

export default function SyriaLocationPicker({ locale, value, onChange }: Props) {
  const ar = locale === "ar";
  const [governorates, setGovernorates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [subdistricts, setSubdistricts] = useState<GeoItem[]>([]);
  const [localities, setLocalities] = useState<GeoItem[]>([]);
  const [neighborhoodSuggestions, setNeighborhoodSuggestions] = useState<NeighborhoodSuggestion[]>([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [localityQuery, setLocalityQuery] = useState("");
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
    loading: translate(locale, "Loading locations…", "جارٍ تحميل المواقع…")
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
        setSelectedNeighborhoodId(value.neighborhoodId ?? "");
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
  }, [value.localityId, value.neighborhoodId, value.latitude, value.longitude]);

  useEffect(() => {
    const searchPoint = focus ?? (
      value.latitude !== undefined && value.longitude !== undefined
        ? { latitude: value.latitude, longitude: value.longitude, zoom: 14 }
        : null
    );
    if (!governorateId || !searchPoint) return;
    let active = true;
    const radiusKm = searchPoint.zoom <= 7 ? "30" : searchPoint.zoom <= 10 ? "18" : searchPoint.zoom <= 12 ? "10" : "5";
    const query = new URLSearchParams({
      governorateId,
      nearLat: String(searchPoint.latitude),
      nearLng: String(searchPoint.longitude),
      radiusKm,
      limit: "100"
    });
    fetch(`/api/geography/neighborhoods?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Unable to load neighbourhood suggestions.");
        return result as GeoResponse & { items: NeighborhoodSuggestion[] };
      })
      .then((result) => { if (active) setNeighborhoodSuggestions(result.items); })
      .catch((cause: unknown) => { if (active) setError(locationError(cause, locale, "Unable to load neighbourhood suggestions.", "تعذّر تحميل اقتراحات الأحياء القريبة.")); });
    return () => { active = false; };
  }, [governorateId, focus, value.latitude, value.longitude]);

  async function chooseGovernorate(id: string) {
    const request = ++selectionRequest.current;
    setGovernorateId(id); setDistrictId(""); setSubdistrictId(""); setDistricts([]); setSubdistricts([]); setLocalities([]); setNeighborhoodSuggestions([]); setSelectedNeighborhoodId("");
    onChange({});
    const item = governorates.find((entry) => entry.id === id);
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
    setDistrictId(id); setSubdistrictId(""); setSubdistricts([]); setLocalities([]); setNeighborhoodSuggestions([]); setSelectedNeighborhoodId("");
    const item = districts.find((entry) => entry.id === id);
    onChange({ district: item ? (item.nameAr || item.nameEn) : undefined });
    if (item?.latitude != null && item.longitude != null) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 10 }); else setFocus(null);
    setError("");
    if (!id) return;
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
    setSubdistrictId(id); setLocalities([]); setNeighborhoodSuggestions([]); setSelectedNeighborhoodId("");
    const item = subdistricts.find((entry) => entry.id === id);
    const selectedDistrict = districts.find((entry) => entry.id === districtId);
    onChange({ district: selectedDistrict ? (selectedDistrict.nameAr || selectedDistrict.nameEn) : undefined });
    if (item?.latitude != null && item.longitude != null) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 12 }); else setFocus(null);
    setError("");
    if (!id) return;
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
    setSelectedNeighborhoodId("");
    setNeighborhoodSuggestions([]);
    const selectedDistrict = districts.find((entry) => entry.id === districtId);
    onChange({
      city: item ? (item.nameAr || item.nameEn) : undefined,
      district: selectedDistrict ? (selectedDistrict.nameAr || selectedDistrict.nameEn) : undefined,
      localityId: id || undefined,
      ...(hasCoordinates ? { latitude: item!.latitude!, longitude: item!.longitude! } : {})
    });
    if (hasCoordinates) setFocus({ latitude: item!.latitude!, longitude: item!.longitude!, zoom: 15 });
  }

  function updateCoordinates(coords: { latitude: number; longitude: number }) {
    setSelectedNeighborhoodId("");
    setNeighborhoodSuggestions([]);
    onChange({ ...value, neighborhoodId: undefined, ...coords });
    setFocus({ ...coords, zoom: 15 });
  }

  const fieldClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--color-ink-900)] outline-none transition focus:border-[var(--color-forest-500)] focus:ring-2 focus:ring-[var(--color-forest-500)]/10 disabled:cursor-not-allowed disabled:opacity-50";
  const name = (item: GeoItem) => item.nameAr || item.nameEn;
  const kindLabel = (kind?: string | null) => {
    if (!kind) return "";
    if (!ar) return kind;
    return ({ city: "مدينة", town: "بلدة", village: "قرية", locality: "تجمع سكاني" } as Record<string, string>)[kind] ?? "موقع";
  };

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <h3 className="font-semibold text-[var(--color-ink-900)]">{translate(locale, "Product location in Syria", "موقع المنتج في سوريا")}</h3>
        <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{translate(locale, "Choose the administrative area from largest to smallest. The map follows each selection.", "اختر الموقع بالتسلسل الإداري من الأكبر إلى الأصغر، وستنتقل الخريطة تلقائياً مع كل اختيار.")}</p>
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
        <button type="button" onClick={() => void searchLocalities()} disabled={busy || !localityQuery.trim()} className="shrink-0 rounded-xl bg-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{labels.searchButton}</button>
      </div>}
      {neighborhoodSuggestions.length > 0 && <label className="block text-sm font-medium">{translate(locale, "Nearby neighbourhood suggestions", "أحياء قريبة مقترحة")}
        <select className={fieldClass} value={selectedNeighborhoodId} onChange={(event) => {
          const selected = neighborhoodSuggestions.find((item) => item.id === event.target.value);
          setSelectedNeighborhoodId(event.target.value);
          if (selected) {
            onChange({ ...value, neighborhoodId: selected.id, neighborhood: selected.nameAr, latitude: selected.latitude, longitude: selected.longitude });
            setFocus({ latitude: selected.latitude, longitude: selected.longitude, zoom: 16 });
          }
        }}>
          <option value="">{translate(locale, "Choose a nearby suggestion…", "اختر حياً قريباً…")}</option>
          {neighborhoodSuggestions.map((item) => <option key={item.id} value={item.id}>{item.nameAr} · {item.distanceKm.toFixed(1)} km</option>)}
        </select>
        <span className="mt-1 block text-xs font-normal leading-5 text-amber-700">{translate(locale, "Suggestions are imported from Akaar's legacy list and are not yet officially verified. Confirm the name and pin before saving.", "هذه اقتراحات مستوردة من قائمة Akaar القديمة ولم تُعتمد رسمياً بعد. تحقق من الاسم والدبوس قبل الحفظ.")}</span>
      </label>}
      <label className="block text-sm font-medium">{labels.neighborhood}
        <input className={fieldClass} value={value.neighborhood ?? ""} maxLength={120} onChange={(event) => { setSelectedNeighborhoodId(""); onChange({ ...value, neighborhoodId: undefined, neighborhood: event.target.value || undefined }); }} placeholder={translate(locale, "e.g. Al-Mazzeh, Abu Rummaneh", "مثال: المزة، أبو رمانة")} />
        <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted)]">{translate(locale, "You can choose a nearby suggestion or enter the local name manually. Neighbourhood is stored separately from the official locality.", "يمكنك اختيار اقتراح قريب أو كتابة الاسم المحلي يدوياً. يُحفظ الحي منفصلاً عن التجمع الإداري الرسمي.")}</span>
      </label>
      {busy && <p role="status" className="text-xs text-[var(--muted)]">{labels.loading}</p>}
      {!busy && !error && governorates.length === 0 && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{translate(locale, "No Syrian geography records are available in this database. Run npm run db:sync-syria-geography to import the official dataset.", "لا توجد بيانات جغرافية سورية في قاعدة البيانات. نفّذ الأمر npm run db:sync-syria-geography لاستيراد البيانات الرسمية.")}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
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
