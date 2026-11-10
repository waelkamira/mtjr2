import { RouteLoadingState } from "@/components/route-states";
import { getPreferredLocale } from "@/server/locale";
import { translate } from "@/lib/locale";

export default async function SellerLoading() {
  const locale = await getPreferredLocale();
  return <RouteLoadingState label={translate(locale, "Loading seller workspace", "جارٍ تحميل مساحة عمل البائع")} />;
}
