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
type GeographySelection = { governorateId: string; districtId?: string; subdistrictId?: string; localityId?: string; neighborhoodId?: string; source: "opensyria"; sourceVersion: "v0.1.5" };
type Props = {
  district: string;
  onGeographyChange: (value: GeographySelection) => void;
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

export default function SyriaLocationPicker({ district, onCityChange, onDistrictChange, onGeographyChange, onFocus, inputClass }: Props) {
  const [governorates, setGovernorates] = useState<SyriaPlace[]>([]);
  const [districts, setDistricts] = useState<SyriaPlace[]>([]);
  const [subdistricts, setSubdistricts] = useState<SyriaPlace[]>([]);
  const [localities, setLocalities] = useState<SyriaPlace[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<SyriaPlace[]>([]);
  const [localityPage, setLocalityPage] = useState(1);
  const [localityTotalPages, setLocalityTotalPages] = useState(1);
  const [neighborhoodPage, setNeighborhoodPage] = useState(1);
  const [neighborhoodTotalPages, setNeighborhoodTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
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
        .then((result) => { if (active) { setLocalities(result.items); setLocalityPage(1); setLocalityTotalPages(result.pagination?.totalPages ?? 1); setCityPlaceId(""); setNeighborhoodId(""); setNeighborhoods([]); setNeighborhoodPage(1); setNeighborhoodTotalPages(1); setManualNeighborhood(""); onCityChange(""); onDistrictChange(""); onGeographyChange({ governorateId, ...(districtId ? { districtId } : {}), ...(subdistrictId ? { subdistrictId } : {}), source: "opensyria", sourceVersion: "v0.1.5" }); } })
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

  async function loadMoreLocalities() {
    if (!subdistrictId || localityPage >= localityTotalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = localityPage + 1;
      const result = await loadLevel("localities", { subdistrictId, page: String(nextPage), ...(search.trim().length >= 2 ? { q: search.trim() } : {}) });
      setLocalities((current) => [...current, ...result.items]);
      setLocalityPage(nextPage);
      setLocalityTotalPages(result.pagination?.totalPages ?? nextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل بقية المواقع."); }
    finally { setLoadingMore(false); }
  }

  async function loadMoreNeighborhoods() {
    if (!subdistrictId || neighborhoodPage >= neighborhoodTotalPages || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = neighborhoodPage + 1;
      const result = await loadLevel("localities", { subdistrictId, kind: "locality", page: String(nextPage) });
      setNeighborhoods((current) => [...current, ...result.items]);
      setNeighborhoodPage(nextPage);
      setNeighborhoodTotalPages(result.pagination?.totalPages ?? nextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل بقية الأحياء."); }
    finally { setLoadingMore(false); }
  }

  function focus(place: SyriaPlace | undefined, zoom: number) {
    if (place?.coordinates) onFocus(place.coordinates, zoom);
  }

  return <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
    <div className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-5 text-[var(--color-copper-600)]" /><h3 className="text-sm font-semibold">الموقع في سوريا</h3></div>
    <p className="text-xs leading-5 text-[var(--muted)]">اختر المحافظة ثم المنطقة والناحية والمدينة، وبعدها الحي إذا كانت له تسمية منشورة في مصدر البيانات. تتحرك الخريطة تلقائياً إلى مركز الموقع المختار.</p>
    <label className="grid gap-1 text-sm">المحافظة<select className={inputClass} value={governorateId} onChange={(event) => { const id = event.target.value; setGovernorateId(id); setDistrictId(""); setSubdistrictId(""); setSearch(""); setCityPlaceId(""); setNeighborhoodId(""); onCityChange(""); onDistrictChange(""); onGeographyChange({ governorateId: id, source: "opensyria", sourceVersion: "v0.1.5" }); focus(governorates.find((item) => item.id === id), 9); }}><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">المنطقة الإدارية<select disabled={!governorateId || loading} className={inputClass} value={districtId} onChange={(event) => { const id = event.target.value; setDistrictId(id); setSubdistrictId(""); setSearch(""); onCityChange(""); onDistrictChange(""); onGeographyChange({ governorateId, ...(id ? { districtId: id } : {}), source: "opensyria", sourceVersion: "v0.1.5" }); focus(districts.find((item) => item.id === id), 10); }}><option value="">اختر المنطقة</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">الناحية<select disabled={!districtId || loading} className={inputClass} value={subdistrictId} onChange={(event) => { const id = event.target.value; setSubdistrictId(id); setSearch(""); onCityChange(""); onDistrictChange(""); onGeographyChange({ governorateId, districtId, ...(id ? { subdistrictId: id } : {}), source: "opensyria", sourceVersion: "v0.1.5" }); focus(subdistricts.find((item) => item.id === id), 11); }}><option value="">اختر الناحية</option>{subdistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm"><span className="flex items-center gap-2">المدينة / البلدة<Search aria-hidden="true" className="size-3.5 text-[var(--muted)]" /></span><input className={inputClass} disabled={!subdistrictId} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن مدينة أو بلدة..." /><select disabled={!subdistrictId || loading} className={inputClass} value={cityPlaceId} onChange={(event) => { const id = event.target.value; const place = cityPlaces.find((item) => item.id === id); setCityPlaceId(id); setNeighborhoodId(""); setManualNeighborhood(""); onCityChange(place?.name ?? ""); onDistrictChange(selectedSubdistrict?.name ?? selectedDistrict?.name ?? ""); onGeographyChange({ governorateId, ...(districtId ? { districtId } : {}), ...(subdistrictId ? { subdistrictId } : {}), ...(id ? { localityId: id } : {}), source: "opensyria", sourceVersion: "v0.1.5" }); focus(place, 14); if (place && subdistrictId) { loadLevel("localities", { subdistrictId, kind: "locality" }).then((result) => { setNeighborhoods(result.items); setNeighborhoodPage(1); setNeighborhoodTotalPages(result.pagination?.totalPages ?? 1); }).catch(() => { setNeighborhoods([]); setNeighborhoodTotalPages(1); }); } }}><option value="">اختر المدينة / البلدة</option>{cityPlaces.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.kind === "city" ? "مدينة" : item.kind === "town" ? "بلدة" : "قرية"}</option>)}</select></label>
    {localityPage < localityTotalPages && <button type="button" disabled={loadingMore} onClick={() => void loadMoreLocalities()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">{loadingMore ? "جارٍ التحميل…" : "تحميل المزيد من المدن والبلدات"}</button>}
    <label className="grid gap-1 text-sm">الحي / المحلة<select disabled={!cityPlaceId || loading} className={inputClass} value={neighborhoodId} onChange={(event) => { const id = event.target.value; const place = neighborhoods.find((item) => item.id === id); setNeighborhoodId(id); setManualNeighborhood(""); if (id === "__other__") onDistrictChange(""); else onDistrictChange(place?.name ?? selectedSubdistrict?.name ?? selectedDistrict?.name ?? ""); onGeographyChange({ governorateId, ...(districtId ? { districtId } : {}), ...(subdistrictId ? { subdistrictId } : {}), ...(cityPlaceId ? { localityId: cityPlaceId } : {}), ...(place && id ? { neighborhoodId: id } : {}), source: "opensyria", sourceVersion: "v0.1.5" }); focus(place, 15); }}><option value="">اختر الحي (إن توفر)</option>{neighborhoods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__other__">حي آخر غير مدرج</option></select></label>
    {neighborhoodPage < neighborhoodTotalPages && <button type="button" disabled={loadingMore} onClick={() => void loadMoreNeighborhoods()} className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">{loadingMore ? "جارٍ التحميل…" : "تحميل المزيد من الأحياء"}</button>}
    {cityPlaceId && (!neighborhoods.length || neighborhoodId === "__other__") && <label className="grid gap-1 text-sm">اسم الحي<input required className={inputClass} maxLength={120} value={manualNeighborhood} onChange={(event) => { setManualNeighborhood(event.target.value); onDistrictChange(event.target.value); }} placeholder="اكتب اسم الحي" /></label>}
    {selectedGovernorate && <p className="text-xs text-[var(--muted)]">المحافظة: {selectedGovernorate.name}{selectedDistrict ? ` · ${selectedDistrict.name}` : ""}{selectedSubdistrict ? ` · ${selectedSubdistrict.name}` : ""}{selectedCityPlace ? ` · ${selectedCityPlace.name}` : ""}{selectedNeighborhood ? ` · ${selectedNeighborhood.name}` : ""}</p>}
    {loading && <p className="text-xs text-[var(--muted)]">جارٍ تحميل المواقع…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <p className="text-[11px] text-[var(--muted)]">المصدر: OpenSyria Data Geography (CC BY 4.0). يشمل المدن والبلدات والقرى والمحلات؛ وقد لا تتوفر أسماء الأحياء لكل مدينة.</p>
  </section>;
}
