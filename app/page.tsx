import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("nod_config")
    .select("key, value")
    .order("key");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16">
        <header className="mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">
            NOD Platform
          </p>

          <h1 className="text-5xl font-bold tracking-tight">
            Nerds of Darts
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            The new NOD website, ticketing and event administration platform.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Events</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Events, tickets, players, teams and schedules.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Games</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Game modes, rules and event schedules.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Administration</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Tickets, finance, communications and operations.
            </p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-semibold">
            Supabase connection
          </h2>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-900 bg-red-950 p-4 text-red-300">
              <p className="font-semibold">Connection failed</p>
              <p className="mt-1 text-sm">
                {error.message}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950 p-4">
              <p className="font-semibold text-emerald-300">
                NODDB connection successful
              </p>

              <div className="mt-4 space-y-2">
                {data?.map((item) => (
                  <div
                    key={item.key}
                    className="flex justify-between border-b border-emerald-900/50 py-2 text-sm"
                  >
                    <span className="text-zinc-400">
                      {item.key}
                    </span>

                    <span className="font-mono text-emerald-300">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <footer className="mt-auto pt-16 text-sm text-zinc-600">
          NOD Platform v0.1.0
        </footer>
      </div>
    </main>
  );
}