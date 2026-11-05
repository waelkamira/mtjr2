import Link from "next/link";

export const metadata = {
  title: "Privacy Notice — Development Draft",
  robots: { index: false, follow: false }
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-10">
        <Link href="/" className="text-xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Version v1 · Development draft</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-forest-950)]">Privacy Notice</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">This preliminary notice is for development and testing only. The Mtjr2 operating company has not yet been incorporated. The responsible operator&apos;s identity and contact details, final legal bases, retention periods and launch disclosures must be completed and reviewed before public launch.</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-[var(--foreground)]">
          <section><h2 className="text-lg font-semibold">1. Data covered by this notice</h2><p>Depending on the features you use, the development platform may process account details such as email address and display name; authentication data such as password hashes, verification and reset-token hashes, session identifiers and security events; consent records; and information you submit to marketplace features such as addresses, messages, support requests, product interactions, cart contents and orders. Do not submit sensitive personal information or payment card data through test forms.</p></section>
          <section><h2 className="text-lg font-semibold">2. Why data is used</h2><p>Data is used to create and secure test accounts, authenticate account access, provide requested features, prevent abuse, troubleshoot errors, maintain audit records and evaluate the marketplace during development. Optional features may involve additional purposes which will be explained when they are introduced.</p></section>
          <section><h2 className="text-lg font-semibold">3. Security measures</h2><p>The application is designed to store password hashes rather than readable passwords, store verification and reset tokens as digests, use protected session cookies, and record selected security events. These technical measures do not guarantee that a system is risk-free. Do not reuse passwords from other services.</p></section>
          <section><h2 className="text-lg font-semibold">4. Service providers and sharing</h2><p>Data may be processed by infrastructure, database, hosting and transactional-email providers where those services are configured. The current development configuration may use Resend for verification and account emails. Payment, shipping, analytics and other integrations must be disclosed separately before they are enabled for real users. Personal data is not intentionally offered for sale.</p></section>
          <section><h2 className="text-lg font-semibold">5. Retention and deletion</h2><p>Development data may be retained while needed to test account, security and marketplace workflows, and test databases may be reset. A final retention schedule, account deletion process, backup handling and legal retention requirements have not yet been established. Do not use a development account to store information you need preserved.</p></section>
          <section><h2 className="text-lg font-semibold">6. Your choices and requests</h2><p>For the development phase, avoid submitting unnecessary personal data. Before public launch, this notice will specify the responsible operator and the process for access, correction, deletion, objection and other applicable privacy requests, together with the relevant supervisory or complaint channels where required.</p></section>
          <section><h2 className="text-lg font-semibold">7. International processing and cookies</h2><p>Hosting and service providers may process data in locations that depend on the selected deployment and provider configuration. The actual hosting regions, international transfer safeguards, cookie inventory and any consent requirements must be confirmed and disclosed before public launch. The application may use essential session cookies to authenticate accounts.</p></section>
          <section><h2 className="text-lg font-semibold">8. Updates and related terms</h2><p>This notice may change during development. The final notice will identify the responsible operator, verified contact details, applicable legal basis for each processing purpose, specific retention periods and relevant rights and procedures. See also the <Link className="font-semibold underline" href="/terms">Terms of Use</Link>.</p></section>
        </div>
        <p className="mt-10 border-t border-[var(--border)] pt-5 text-xs text-[var(--muted)]">Document status: development draft · Version: v1 · Last updated: 4 November 2026</p>
      </article>
    </main>
  );
}
