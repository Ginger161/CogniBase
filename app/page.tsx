import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-12 text-center gap-8 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Image src="/logo.png" alt="CogniBase" width={192} height={64} priority className="w-44 h-auto object-contain" />

      <div className="flex flex-col gap-4 max-w-2xl">
        <h1 className="text-[clamp(2.1rem,7vw,4rem)] font-bold tracking-tight leading-[1.08]">
          Every lecture,
          <br />
          <span className="text-[var(--accent-text)]">perfectly synthesized.</span>
        </h1>
        <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
          Add your notes, slides and videos. Ask questions that cite their sources, and turn any of it into study guides and flashcards.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        <Link href="/signup" className="h-12 px-8 rounded-xl bg-[var(--accent-solid)] text-[var(--on-accent)] font-bold flex items-center justify-center">
          Get started
        </Link>
        <Link href="/login" className="h-12 px-8 rounded-xl border border-[var(--border-strong)] font-semibold flex items-center justify-center">
          Sign in
        </Link>
      </div>
    </main>
  );
}
