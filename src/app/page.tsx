import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center overflow-x-hidden bg-[#070d1a] px-6 py-16 text-slate-100">
      <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 left-[-5rem] h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-16 lg:grid-cols-[1.1fr_.9fr]">
        <section>
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.07] px-4 py-2 text-sm text-cyan-200">
            <Sparkles className="size-4" /> Tempat huru hara Artem Geng
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl">
            # Kerja bareng,
            <span className="block bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              tewas bareng.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
            Untuk pekerjaan besok, kita serahkan pada diri kita yang besok.
            Well...
          </p>
          <SignedOut>
            <div className="mt-9 flex flex-wrap gap-3">
              <SignUpButton>
                <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-400 px-6 font-semibold text-slate-950 transition hover:bg-cyan-300">
                  Gabung sekarang <ArrowRight className="size-4" />
                </button>
              </SignUpButton>
              <SignInButton>
                <button className="h-12 rounded-xl border border-slate-700 px-6 font-medium text-slate-200 transition hover:bg-white/5">
                  Masuk
                </button>
              </SignInButton>
            </div>
          </SignedOut>
          <SignedIn>
            <Link
              href="/tasks"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-xl bg-cyan-400 px-6 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Buka portal <ArrowRight className="size-4" />
            </Link>
          </SignedIn>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <Feature
            icon={<CheckCircle2 className="size-5" />}
            title="Task yang teratur"
            description="Prioritaskan pekerjaan dan pantau progres pribadi."
          />
          <Feature
            icon={<MessagesSquare className="size-5" />}
            title="Obrolan komunitas"
            description="Terhubung langsung dengan anggota Artem Geng."
          />
          <div className="rounded-2xl border border-blue-400/15 bg-gradient-to-br from-blue-500/15 to-cyan-500/[.04] p-6 sm:col-span-2">
            <div className="mb-7 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">Ruang kerja kamu</span>
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_14px_#34d399]" />
            </div>
            <div className="space-y-3">
              {["Rancang ide berikutnya", "Review progres tim", "Tetap terhubung"].map(
                (item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-slate-950/50 px-4 py-3"
                  >
                    <span className={`size-2 rounded-full ${index === 1 ? "bg-blue-400" : "bg-slate-600"}`} />
                    <span className="text-sm text-slate-300">{item}</span>
                    <span className="ml-auto text-xs text-slate-600">
                      {index === 0 ? "Hari ini" : index === 1 ? "Aktif" : "Artem Geng"}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
        {icon}
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}
