import Link from "next/link";

export const metadata = {
  title: "Terms of Use — Development Draft",
  robots: { index: false, follow: false }
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-10">
        <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Version v1 · Development draft</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Terms of Use</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">This is a preliminary document for development and testing only. Mtjr2 is being built and its operating company has not yet been incorporated. This draft is not a final legal agreement and must be reviewed and completed before public launch.</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-[var(--foreground)]">
          <section><h2 className="text-lg font-semibold">1. About the platform</h2><p>Mtjr2 is under development as a multi-vendor marketplace intended to help customers discover products and interact with independent sellers. Features, markets, payment methods, delivery options and seller services may change while the platform is being built. A feature is not available merely because it is described as a future capability.</p></section>
          <section><h2 className="text-lg font-semibold">2. Development access and accounts</h2><p>Test access is provided to evaluate the platform. You must provide an email address you control, keep your credentials confidential, and notify the platform operator if you suspect unauthorized access. Email verification may be required. The operator may suspend test access to protect the platform or its users.</p></section>
          <section><h2 className="text-lg font-semibold">3. Acceptable use</h2><p>You must not misuse the service, attempt unauthorized access, interfere with its operation, submit unlawful or misleading content, infringe another person's rights, or use test functionality to conduct real transactions unless a feature is expressly enabled for that purpose.</p></section>
          <section><h2 className="text-lg font-semibold">4. Marketplace and sellers</h2><p>Mtjr2 is being developed to support independent sellers. Seller onboarding, product listings, order handling, payments, delivery, returns and dispute workflows may be incomplete or unavailable during development. Do not treat a test listing, price, order or status as an offer or confirmation for a real transaction.</p></section>
          <section><h2 className="text-lg font-semibold">5. Content and availability</h2><p>Product descriptions, images, prices, stock, demonstrations and other test content may be incomplete or inaccurate. The platform is provided for development evaluation and may be changed, interrupted or reset without notice. Do not rely on test data for purchasing or business decisions.</p></section>
          <section><h2 className="text-lg font-semibold">6. Intellectual property and user content</h2><p>The platform software, branding and original materials are protected by applicable rights. You retain rights you hold in content you submit, while allowing the platform to use that content as needed to display and test the relevant feature. Do not upload content you are not entitled to use.</p></section>
          <section><h2 className="text-lg font-semibold">7. Privacy</h2><p>Personal data handling is described in the <Link className="font-semibold underline" href="/privacy">Privacy Notice</Link>. Do not submit payment card details, identity documents, health data or other sensitive information through development features unless specifically requested through an approved secure workflow.</p></section>
          <section><h2 className="text-lg font-semibold">8. Changes and contact</h2><p>These development terms may be revised as the platform evolves. The final version will identify the responsible operator, contact details, applicable law, dispute process and any mandatory consumer information before public launch. No company registration or regulatory authorization is represented by this draft.</p></section>
        </div>
        <p className="mt-10 border-t border-[var(--border)] pt-5 text-xs text-[var(--muted)]">Document status: development draft · Version: v1 · Last updated: 4 November 2026</p>
      </article>
    </main>
  );
}
