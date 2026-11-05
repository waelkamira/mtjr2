import AdminShipmentDetailPage from "@/features/admin/shipment-detail-page";

export default async function AdminShipmentDetailRoute({ params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params;
  return <AdminShipmentDetailPage shipmentId={shipmentId} />;
}
