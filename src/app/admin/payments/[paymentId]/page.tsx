import AdminPaymentDetailPage from "@/features/admin/payment-detail-page";

export default async function AdminPaymentDetailRoute({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return <AdminPaymentDetailPage paymentId={paymentId} />;
}
