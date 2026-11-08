"use client";

import { useEffect, useMemo, useState } from "react";
import LeafletLocationMap from "@/components/maps/leaflet-location-map";
import { translate } from "@/lib/locale";

type GeoItem = {
  id: string;
  nameAr: string | null;
  nameEn: string;
  latitude: number | null;
  longitude: number | null;
  kind?: string | null;
};
type GeoResponse = { items: GeoItem[]; pagination: { total: number; totalPages: number } };
type LocationValue = {
  localityId?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
};
type Props = {
  locale: string;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

async function loadLevel(level: string, params: Record<string, string> = {}): Promise<GeoResponse> {
  const query = new URLSearchParams(params);
  const response = await fetch(`/api/geography/${level}?${query.toString()}`, { cache: "force-cache" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Unable to load Syrian locations.");
  return payload as GeoResponse;
}

export default function SyriaLocationPicker({ locale, value, onChange }: Props) {
  const ar = locale === "ar";
  const [governorates, setGovernorates] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [subdistricts, setSubdistricts] = useState<GeoItem[]>([]);
  const [localities, setLocalities] = useState<GeoItem[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [localityQuery, setLocalityQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<{ latitude: number; longitude: number; zoom: number } | null>(null);
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
    setBusy(true);
    loadLevel("governorates").then((result) => { if (active) setGovernorates(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load governorates."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function chooseGovernorate(id: string) {
    setGovernorateId(id); setDistrictId(""); setSubdistrictId(""); setDistricts([]); setSubdistricts([]); setLocalities([]);
    onChange({ neighborhood: value.neighborhood });
    const item = governorates.find((entry) => entry.id === id);
    if (item?.latitude && item.longitude) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 7 });
    setError("");
    if (!id) return;
    setBusy(true);
    try { setDistricts((await loadLevel("districts", { governorateId: id })).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load districts."); }
    finally { setBusy(false); }
  }

  async function chooseDistrict(id: string) {
    setDistrictId(id); setSubdistrictId(""); setSubdistricts([]); setLocalities([]);
    onChange({ neighborhood: value.neighborhood });
    const item = districts.find((entry) => entry.id === id);
    if (item?.latitude && item.longitude) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 9 });
    setError("");
    if (!id) return;
    setBusy(true);
    try { setSubdistricts((await loadLevel("subdistricts", { districtId: id })).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load subdistricts."); }
    finally { setBusy(false); }
  }

  async function chooseSubdistrict(id: string) {
    setSubdistrictId(id); setLocalities([]);
    onChange({ neighborhood: value.neighborhood });
    const item = subdistricts.find((entry) => entry.id === id);
    if (item?.latitude && item.longitude) setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 11 });
    setError("");
    if (!id) return;
    setBusy(true);
    try { setLocalities((await loadLevel("localities", { subdistrictId: id, limit: "100" })).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load localities."); }
    finally { setBusy(false); }
  }

  async function searchLocalities() {
    if (!subdistrictId || !localityQuery.trim()) return;
    setBusy(true); setError("");
    try { setLocalities((await loadLevel("localities", { subdistrictId, q: localityQuery.trim(), limit: "100" })).items); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to search localities."); }
    finally { setBusy(false); }
  }

  function chooseLocality(id: string) {
    const item = localities.find((entry) => entry.id === id);
    onChange({
      localityId: id || undefined,
      neighborhood: value.neighborhood,
      ...(item?.latitude !== null && item?.latitude !== undefined && item.longitude !== null && item.longitude !== undefined
        ? { latitude: item.latitude, longitude: item.longitude }
        : {})
    });
    if (item?.latitude !== null && item?.latitude !== undefined && item.longitude !== null && item.longitude !== undefined) {
      setFocus({ latitude: item.latitude, longitude: item.longitude, zoom: 14 });
    }
  }

  function updateCoordinates(coords: { latitude: number; longitude: number }) {
    onChange({ ...value, ...coords });
  }

  const fieldClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--color-ink-900)] outline-none transition focus:border-[var(--color-forest-500)] focus:ring-2 focus:ring-[var(--color-forest-500)]/10 disabled:cursor-not-allowed disabled:opacity-50";
  const name = (item: GeoItem) => item.nameAr || item.nameEn;

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div>
        <h3 className="font-semibold text-[var(--color-ink-900)]">{translate(locale, "Product location in Syria", "موقع المنتج في سوريا")}</h3>
        <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{translate(locale, "Choose the administrative area from largest to smallest. The map follows each selection.", "اختر الموقع بالتسلسل الإداري من الأكبر إلى الأصغر، وستنتقل الخريطة تلقائياً مع كل اختيار.")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">{labels.governorate}
          <select className={fieldClass} value={governorateId} onChange={(event) => void chooseGovernorate(event.target.value)}>
            <option value="">{labels.choose}</option>
            {governorates.map((item) => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{labels.district}
          <select className={fieldClass} value={districtId} disabled={!governorateId || busy} onChange={(event) => void chooseDistrict(event.target.value)}>
            <option value="">{labels.choose}</option>
            {districts.map((item) => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{labels.subdistrict}
          <select className={fieldClass} value={subdistrictId} disabled={!districtId || busy} onChange={(event) => void chooseSubdistrict(event.target.value)}>
            <option value="">{labels.choose}</option>
            {subdistricts.map((item) => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{labels.locality}
          <select className={fieldClass} value={value.localityId ?? ""} disabled={!subdistrictId || busy} onChange={(event) => chooseLocality(event.target.value)}>
            <option value="">{labels.choose}</option>
            {localities.map((item) => <option key={item.id} value={item.id}>{name(item)}{item.kind ? ` · ${item.kind}` : ""}</option>)}
          </select>
        </label>
      </div>
      {subdistrictId && <div className="flex gap-2">
        <input className={fieldClass + " mt-0 min-w-0"} value={localityQuery} onChange={(event) => setLocalityQuery(event.target.value)} placeholder={labels.search} />
        <button type="button" onClick={() => void searchLocalities()} disabled={busy || !localityQuery.trim()} className="shrink-0 rounded-xl bg-[var(--color-ink-800)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{labels.searchButton}</button>
      </div>}
      <label className="block text-sm font-medium">{labels.neighborhood}
        <input className={fieldClass} value={value.neighborhood ?? ""} maxLength={120} onChange={(event) => onChange({ ...value, neighborhood: event.target.value || undefined })} placeholder={translate(locale, "e.g. Al-Mazzeh, Abu Rummaneh", "مثال: المزة، أبو رمانة")} />
        <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted)]">{translate(locale, "The published national dataset does not yet contain a verified neighbourhood list. Enter the local neighbourhood name; it is stored separately from the official locality.", "قاعدة البيانات الوطنية المنشورة لا تتضمن حالياً قائمة أحياء موثقة وشاملة. أدخل اسم الحي المحلي، وسيُحفظ منفصلاً عن التجمع الإداري الرسمي.")}</span>
      </label>
      {busy && <p role="status" className="text-xs text-[var(--muted)]">{labels.loading}</p>}
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
