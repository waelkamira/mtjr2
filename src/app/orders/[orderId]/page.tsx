import OrderDetailPage from "@/features/orders/order-detail-page";
type PageProps = { params: Promise<{ orderId: string }>; searchParams: Promise<{ payment?: string }> };
export default async function OrderPage({ params, searchParams }: PageProps) { const [{ orderId }, search] = await Promise.all([params, searchParams]); return <OrderDetailPage orderId={orderId} returnedFromPayment={search.payment === "success"} />; }
