import { RouteLoadingState } from "@/components/route-states";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export default async function AdminLoading() {
  const locale = await getPreferredLocale();
  return <RouteLoadingState label={translate(locale, "Loading administration", "جارٍ تحميل لوحة الإدارة")} />;
}
