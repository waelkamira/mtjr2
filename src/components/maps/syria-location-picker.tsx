"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";

export type SyriaPlace = {
  id: string;
  name: string;
  englishName: string;
  kind: string;
  governorateId: string | null;
  districtId: string | null;
  subdistrictId: string | null;
  coordinates: { latitude: number; longitude: number } | null;
};
type Level = "governorates" | "districts" | "subdistricts" | "localities";
type Props = {
  city: string;
  district: string;
  onCityChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onFocus: (coordinates: { latitude: number; longitude: number }, zoom: number) => void;
  inputClass: string;
};

const labels: Record<Level, string> = {
  governorates: "المحافظة",
  districts: "المنطقة الإدارية",
  subdistricts: "الناحية",
  localities: "المدينة / البلدة / المحلة",
};

async function loadLevel(level: Level, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ level, ...params });
  const response = await fetch(`/api/geography/syria?${query.toString()}`, { cache: "force-cache" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "تعذر تحميل المواقع السورية.");
  return payload as { items: SyriaPlace[]; pagination: { totalPages?: number } | null };
}

export default function SyriaLocationPicker({ city, district, onCityChange, onDistrictChange, onFocus, inputClass }: Props) {
  const [governorates, setGovernorates] = useState<SyriaPlace[]>([]);
  const [districts, setDistricts] = useState<SyriaPlace[]>([]);
  const [subdistricts, setSubdistricts] = useState<SyriaPlace[]>([]);
  const [localities, setLocalities] = useState<SyriaPlace[]>([]);
  const [governorateId, setGovernorateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [subdistrictId, setSubdistrictId] = useState("");
  const [localityId, setLocalityId] = useState("");
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
    if (!governorateId) { setDistricts([]); setDistrictId(""); setSubdistricts([]); setSubdistrictId(""); setLocalities([]); setLocalityId(""); return; }
    let active = true;
    setLoading(true); setError("");
    loadLevel("districts", { governorateId }).then((result) => { if (active) setDistricts(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المناطق."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [governorateId]);

  useEffect(() => {
    if (!districtId) { setSubdistricts([]); setSubdistrictId(""); setLocalities([]); setLocalityId(""); return; }
    let active = true;
    setLoading(true); setError("");
    loadLevel("subdistricts", { districtId }).then((result) => { if (active) setSubdistricts(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل النواحي."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [districtId]);

  useEffect(() => {
    if (!subdistrictId) { setLocalities([]); setLocalityId(""); return; }
    let active = true;
    setLoading(true); setError("");
    loadLevel("localities", { subdistrictId, ...(search.trim().length >= 2 ? { q: search.trim() } : {}) })
      .then((result) => { if (active) setLocalities(result.items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "تعذر تحميل المدن والأحياء."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [subdistrictId, search]);

  const selectedGovernorate = useMemo(() => governorates.find((item) => item.id === governorateId), [governorates, governorateId]);
  const selectedDistrict = useMemo(() => districts.find((item) => item.id === districtId), [districts, districtId]);
  const selectedSubdistrict = useMemo(() => subdistricts.find((item) => item.id === subdistrictId), [subdistricts, subdistrictId]);
  const selectedLocality = useMemo(() => localities.find((item) => item.id === localityId), [localities, localityId]);

  function focus(place: SyriaPlace | undefined, zoom: number) {
    if (place?.coordinates) onFocus(place.coordinates, zoom);
  }

  return <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
    <div className="flex items-center gap-2"><MapPin aria-hidden="true" className="size-5 text-[var(--color-copper-600)]" /><h3 className="text-sm font-semibold">الموقع في سوريا</h3></div>
    <p className="text-xs leading-5 text-[var(--muted)]">اختر التسلسل الإداري للوصول إلى المدينة أو البلدة أو المحلة. تتحرك الخريطة تلقائياً إلى مركز كل موقع عند اختياره.</p>
    <label className="grid gap-1 text-sm">{labels.governorates}<select className={inputClass} value={governorateId} onChange={(event) => { const id = event.target.value; setGovernorateId(id); setDistrictId(""); setSubdistrictId(""); setLocalityId(""); onCityChange(""); onDistrictChange(""); focus(governorates.find((item) => item.id === id), 9); }}><option value="">اختر المحافظة</option>{governorates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">{labels.districts}<select disabled={!governorateId || loading} className={inputClass} value={districtId} onChange={(event) => { const id = event.target.value; setDistrictId(id); setSubdistrictId(""); setLocalityId(""); focus(districts.find((item) => item.id === id), 10); }}><option value="">اختر المنطقة الإدارية</option>{districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm">{labels.subdistricts}<select disabled={!districtId || loading} className={inputClass} value={subdistrictId} onChange={(event) => { const id = event.target.value; setSubdistrictId(id); setLocalityId(""); focus(subdistricts.find((item) => item.id === id), 11); }}><option value="">اختر الناحية</option>{subdistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-sm"><span className="flex items-center gap-2">{labels.localities}<Search aria-hidden="true" className="size-3.5 text-[var(--muted)]" /></span><input className={inputClass} disabled={!subdistrictId} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن مدينة أو حي..." /><select disabled={!subdistrictId || loading} className={inputClass} value={localityId} onChange={(event) => { const id = event.target.value; const place = localities.find((item) => item.id === id); setLocalityId(id); if (place) { onCityChange(place.name); onDistrictChange(selectedSubdistrict?.name ?? selectedDistrict?.name ?? ""); focus(place, 14); } }}><option value="">اختر المدينة / البلدة / المحلة</option>{localities.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.kind === "city" ? "مدينة" : item.kind === "town" ? "بلدة" : item.kind === "village" ? "قرية" : "محلة"}</option>)}</select></label>
    {selectedGovernorate && <p className="text-xs text-[var(--muted)]">المحافظة: {selectedGovernorate.name}{selectedDistrict ? ` · ${selectedDistrict.name}` : ""}{selectedSubdistrict ? ` · ${selectedSubdistrict.name}` : ""}{selectedLocality ? ` · ${selectedLocality.name}` : ""}</p>}
    {loading && <p className="text-xs text-[var(--muted)]">جارٍ تحميل المواقع…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <p className="text-[11px] text-[var(--muted)]">مصدر البيانات: OpenSyria · تتضمن القائمة المدن والبلدات والقرى والمحلات المنشورة، ولا تدّعي اكتمال أسماء الأحياء غير المصنفة في المصدر.</p>
  </section>;
}
