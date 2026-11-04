import Link from "next/link";

export default function RegistrationUnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white p-8 shadow-[var(--shadow-card)]">
        <Link href="/" className="text-2xl font-semibold text-[var(--color-forest-950)]">mtjr<span className="text-[var(--color-copper-600)]">.</span></Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-copper-600)]">Account registration</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-forest-950)]">Registration is not open yet</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">We have not published the approved Terms of Service and Privacy Notice required for informed registration consent. Account creation is therefore intentionally unavailable until those documents are supplied and reviewed. No account will be created from this page.</p>
        <Link href="/login" className="mt-8 inline-flex rounded-xl bg-[var(--color-forest-900)] px-5 py-3 text-sm font-semibold text-white">Back to sign in</Link>
      </section>
    </main>
  );
}
