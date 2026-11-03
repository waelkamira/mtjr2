import OrderDetailPage from "@/features/orders/order-detail-page";
type PageProps = { params: Promise<{ orderId: string }> };
export default async function OrderPage({ params }: PageProps) { const { orderId } = await params; return <OrderDetailPage orderId={orderId} />; }
