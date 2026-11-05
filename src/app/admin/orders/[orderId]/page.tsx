import AdminOrderDetailPage from "@/features/admin/order-detail-page";

export default async function AdminOrderDetailRoute({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <AdminOrderDetailPage orderId={orderId} />;
}
