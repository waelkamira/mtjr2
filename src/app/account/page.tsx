import Link from "next/link";

const sections = [
  { title: "Personal profile", description: "Your name and account details", href: "/account/profile" },
  { title: "My orders", description: "Track purchases and order history", href: "/account/orders" },
  { title: "Favorites", description: "Products you have saved", href: "/account/wishlist" },
  { title: "Saved addresses", description: "Delivery addresses for checkout", href: "/account/addresses" },
  { title: "Returns", description: "Manage return requests", href: "/account/returns" },
  { title: "Reviews", description: "Your product and store reviews", href: "/account/reviews" },
  { title: "Questions", description: "Your product questions and answers", href: "/account/questions" },
  { title: "Messages", description: "Conversations with stores", href: "/account/messages" },
  { title: "Support", description: "Help requests and support tickets", href: "/account/support" },
  { title: "Notifications", description: "Updates about your account and orders", href: "/notifications" },
  { title: "Seller workspace", description: "Apply to sell or manage your store", href: "/seller" }
];

export default function AccountHomePage() {
  return <main className="min-h-screen bg-[var(--background)] px-5 py-10"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between"><Link href="/" className="text-2xl font-semibold text-[var(--color-ink-950)]">mtjr<span className="text-[var(--color-lavender-600)]">.</span></Link><Link href="/" className="text-sm text-[var(--color-ink-600)]">Continue shopping</Link></header><p className="mt-10 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-lavender-600)]">Your marketplace</p><h1 className="mt-2 text-3xl font-semibold text-[var(--color-ink-950)]">My account</h1><p className="mt-2 text-sm text-[var(--muted)]">Your purchases, saved items, profile and seller tools in one place.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map(section=><Link key={section.href} href={section.href} className="clay-surface rounded-[var(--radius-card)] border border-[var(--border)] p-5 transition hover:-translate-y-0.5 hover:shadow-clay-raised-hover"><h2 className="font-semibold text-[var(--color-ink-950)]">{section.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{section.description}</p><span className="mt-4 inline-block text-sm font-semibold text-[var(--color-lavender-600)]">Open →</span></Link>)}</div></div></main>;
}
