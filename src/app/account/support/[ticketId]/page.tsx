import SupportTicketPage from "@/features/account/support-ticket-page";
type Props={params:Promise<{ticketId:string}>};
export default async function SupportTicketRoute({params}:Props){const {ticketId}=await params;return <SupportTicketPage ticketId={ticketId}/>;}
