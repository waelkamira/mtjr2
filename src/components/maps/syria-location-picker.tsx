"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";

export type SyriaPlace = {
  id: string;
  name: string;
  englishName: string;
  kind: "city" | "town" | "village" | "locality" | string;
  governorateId: string | null;
  districtId: string | null;
  subdistrictId: string | null;
  coordinates: { latitude: number; longitude: number } | null;
};
type Level = "governorates" | "districts" | "subdistricts" | "localities";
type Props = {
  district: string;
  onCityChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onFocus: (coordinates: { latitude: number; longitude: number }, zoom: number) => void;
  inputClass: string;
};

async function loadLevel(level: Level, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ level, ...params });
  const response = await fetch(`/api/geography/syria?${query.toString()}`, { cache: "force-cache" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "تعذر تحميل المواقع السورية.");
  return payload as { items: SyriaPlace[]; pagination: { totalPages?: number } | null };
}

export default function SyriaLocationPicker({ district, onCityChange, onDistrictChange, onFocus, inputClass }: Props) {
  const [governorates, setGovernorates] = useState<SyriaPlace[]>([]);
  const [districts, setDistricts] = useState<SyriaPlace[]>([]);
  const [subdistricts, setSubdistricts] = useState<SyriaPlace[]>([]);
  const [localities, setLocalities] = useState<SyriaPlace[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<SyriaPlace[]>([]);
  const [manualNeighborhood, setManualNeighborhood] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [cityPlaceId, setCityPlaceId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadLevel("governorates").then((result) => { if (active) setGovernorates(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المحافظات."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!governorateId) { setDistricts([]); setDistrictId(""); setSubdistricts([]); setSubdistrictId(""); setLocalities([]); setNeighborhoods([]); setCityPlaceId(""); setNeighborhoodId(""); setManualNeighborhood(""); return; }
    let active = true;
    setLoading(true); setError("");
    loadLevel("districts", { governorateId }).then((result) => { if (active) setDistricts(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المناطق."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [governorateId]);

  useEffect(() => {
    if (!districtId) { setSubdistricts([]); setSubdistrictId(""); setLocalities([]); setNeighborhoods([]); setCityPlaceId(""); setNeighborhoodId(""); setManualNeighborhood(""); return; }
    let active = true;
    setLoading(true); setError("");
    loadLevel("subdistricts", { districtId }).then((result) => { if (active) setSubdistricts(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل النواحي."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [districtId]);

  useEffect(() => {
    if (!subdistrictId) { setLocalities([]); setCityPlaceId(""); setNeighborhoodId(""); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true); setError("");
      loadLevel("localities", { subdistrictId, ...(search.trim().length >= 2 ? { q: search.trim() } : {}) })
        .then((result) => { if (active) { setLocalities(result.items); setCityPlaceId(""); setNeighborhoodId(""); setNeighborhoods([]); setManualNeighborhood(""); } })
        .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المدن والأحياء."); })
        .finally(() => { if (active) setLoading(false); });
    }, search.trim().length >= 2 ? 350 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [subdistrictId, search]);

  const selectedGovernorate = useMemo(() => governorates.find((item) => item.id === governorateId), [governorates, governorateId]);
  const selectedDistrict = useMemo(() => districts.find((item) => item.id === districtId), [districts, districtId]);
  const selectedSubdistrict = useMemo(() => subdistricts.find((item) => item.id === subdistrictId), [subdistricts, subdistrictId]);
  const cityPlaces = useMemo(() => localities.filter((item) => item.kind === "city" || item.kind === "town" || item.kind === "village"), [localities]);

  const selectedCityPlace = cityPlaces.find((item) => item.id === cityPlaceId);
  const selectedNeighborhood = neighborhoods.find((item) => item.id === neighborhoodId);

  function focus(place: SyriaPlace | undefined, zoom: number) {
    if (place?.coordinates) onFocus(place.coordinates, zoom);
  }

  return <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
    <div className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-5 text-[var(--color-copper-600)]" /><h3 className="text-sm font-semibold">الموقع في سوريا</h3></div>
    <p className="text-xs leading-5 text-[var(--muted)]">اختر المحافظة ثم المنطقة والناحية والمدينة، وبعدها الحي إذا كانت له تسمية منشورة في مصدر البيانات. تتحرك الخريطة تلقائياً إلى مركز الموقع المختار.</p>
    <label className="grid gap-1 text-sm">المحافظة<select className={inputClass} value={governorateId} onChange={(event) => { const id = event.target.value; setGovernorateId(id); setDistrictId(""); setSubdistrictId(""); setSearch(""); setCityPlaceId(""); setNeighborhoodId(""); onCityChange(""); onDistrictChange(""); focus(governorates.find((item) => item.id === id), 9); }}><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">المنطقة الإدارية<select disabled={!governorateId || loading} className={inputClass} value={districtId} onChange={(event) => { const id = event.target.value; setDistrictId(id); setSubdistrictId(""); setSearch(""); onCityChange(""); onDistrictChange(""); focus(districts.find((item) => item.id === id), 10); }}><option value="">اختر المنطقة</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">الناحية<select disabled={!districtId || loading} className={inputClass} value={subdistrictId} onChange={(event) => { const id = event.target.value; setSubdistrictId(id); setSearch(""); onCityChange(""); onDistrictChange(""); focus(subdistricts.find((item) => item.id === id), 11); }}><option value="">اختر الناحية</option>{subdistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm"><span className="flex items-center gap-2">المدينة / البلدة<Search aria-hidden="true" className="size-3.5 text-[var(--muted)]" /></span><input className={inputClass} disabled={!subdistrictId} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن مدينة أو بلدة..." /><select disabled={!subdistrictId || loading} className={inputClass} value={cityPlaceId} onChange={(event) => { const id = event.target.value; const place = cityPlaces.find((item) => item.id === id); setCityPlaceId(id); setNeighborhoodId(""); setManualNeighborhood(""); onCityChange(place?.name ?? ""); onDistrictChange(selectedSubdistrict?.name ?? selectedDistrict?.name ?? ""); focus(place, 14); if (place && subdistrictId) { loadLevel("localities", { subdistrictId, kind: "locality" }).then((result) => setNeighborhoods(result.items)).catch(() => setNeighborhoods([])); } }}><option value="">اختر المدينة / البلدة</option>{cityPlaces.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.kind === "city" ? "مدينة" : item.kind === "town" ? "بلدة" : "قرية"}</option>)}</select></label>
    <label className="grid gap-1 text-sm">الحي / المحلة<select disabled={!cityPlaceId || loading} className={inputClass} value={neighborhoodId} onChange={(event) => { const id = event.target.value; const place = neighborhoods.find((item) => item.id === id); setNeighborhoodId(id); onDistrictChange(place?.name ?? ""); focus(place, 15); }}><option value="">اختر الحي (إن توفر)</option>{neighborhoods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {!neighborhoods.length && cityPlaceId && <label className="grid gap-1 text-sm">اسم الحي (إذا لم يكن مدرجاً)<input className={inputClass} maxLength={120} value={manualNeighborhood || district} onChange={(event) => { setManualNeighborhood(event.target.value); onDistrictChange(event.target.value); }} placeholder="اكتب اسم الحي" /></label>}
    {selectedGovernorate && <p className="text-xs text-[var(--muted)]">المحافظة: {selectedGovernorate.name}{selectedDistrict ? ` · ${selectedDistrict.name}` : ""}{selectedSubdistrict ? ` · ${selectedSubdistrict.name}` : ""}{selectedCityPlace ? ` · ${selectedCityPlace.name}` : ""}{selectedNeighborhood ? ` · ${selectedNeighborhood.name}` : ""}</p>}
    {loading && <p className="text-xs text-[var(--muted)]">جارٍ تحميل المواقع…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <p className="text-[11px] text-[var(--muted)]">المصدر: OpenSyria Data Geography (CC BY 4.0). يشمل المدن والبلدات والقرى والمحلات؛ وقد لا تتوفر أسماء الأحياء لكل مدينة.</p>
  </section>;
}
