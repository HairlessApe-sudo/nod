"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Profile = {
  id: string;
  full_name: string | null;
  person_id: string | null;
};

type EventHistory = {
  person_id: string;
  event_id: string;
  event_name: string;
  event_slug: string;
  starts_at: string;
  ends_at: string | null;
  ticket_id: string;
  ticket_number: number;
  ticket_status: string;
  claimed_at: string | null;
  checked_in_at: string | null;
  team_id: string | null;
  team_name: string | null;
  team_colour: string | null;
  team_colour_hex: string | null;
};

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<EventHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, person_id")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      if (profileData?.person_id) {
        const { data: historyData } = await supabase
          .from("player_event_history")
          .select("*")
          .eq("person_id", profileData.person_id)
          .order("starts_at", { ascending: false });

        setHistory(historyData ?? []);
      }

      setLoading(false);
    }

    loadAccount();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        Loading your NOD account...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        <h1 className="text-3xl font-bold">
          You are not signed in.
        </h1>

        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-black"
        >
          Sign in
        </a>
      </main>
    );
  }

  const uniqueEvents = new Set(
    history.map((event) => event.event_id)
  ).size;

  const uniqueTickets = new Set(
    history.map((event) => event.ticket_id)
  ).size;

  const uniqueTeams = new Set(
    history
      .map((event) => event.team_colour)
      .filter(Boolean)
  ).size;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
              NOD Player
            </p>

            <h1 className="mt-3 text-4xl font-bold">
              My NOD
            </h1>

            <p className="mt-2 text-zinc-400">
              {profile?.full_name || user.email}
            </p>
          </div>

          <button
            onClick={signOut}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
          >
            Sign out
          </button>
        </header>

        {!profile?.person_id ? (
          <section className="mt-12 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
            <h2 className="text-2xl font-semibold">
              Welcome to NOD
            </h2>

            <p className="mt-3 max-w-2xl text-zinc-400">
              Your account isn't linked to a NOD player record yet.
              Once you purchase a ticket or link an existing ticket,
              your event history will appear here.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-12 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">
                  Events
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {uniqueEvents}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">
                  Tickets
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {uniqueTickets}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm text-zinc-500">
                  Teams played for
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {uniqueTeams}
                </p>
              </div>
            </section>

            <section className="mt-12">
              <h2 className="text-2xl font-semibold">
                Event history
              </h2>

              {history.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
                  You don't have any event history yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {history.map((event) => (
                    <article
                      key={event.ticket_id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                    >
                      <div className="flex flex-col justify-between gap-4 md:flex-row">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {event.event_name}
                          </h3>

                          <p className="mt-1 text-sm text-zinc-500">
                            {new Date(
                              event.starts_at
                            ).toLocaleDateString("en-GB")}
                          </p>
                        </div>

                        <div className="text-left md:text-right">
                          {event.team_colour && (
                            <p
                              className="font-semibold"
                              style={{
                                color:
                                  event.team_colour_hex ??
                                  undefined,
                              }}
                            >
                              {event.team_colour}
                            </p>
                          )}

                          <p className="mt-1 text-sm text-zinc-500">
                            {event.checked_in_at
                              ? "Checked in"
                              : event.ticket_status}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}