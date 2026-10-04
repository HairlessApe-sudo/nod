import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TicketSelector from "@/components/TicketSelector";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function EventPage({
  params,
}: PageProps) {
  const { slug } = await params;

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(`
      id,
      name,
      slug,
      short_description,
      description,
      location_name,
      location_address,
      starts_at,
      ends_at,
      capacity,
      status,
      catering_included,
      featured_image_url
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (eventError) {
    console.error(eventError);
    throw new Error("Unable to load event.");
  }

  if (!event) {
    notFound();
  }

  const { data: ticketTypes, error: ticketError } =
    await supabase
      .from("ticket_types")
      .select(`
        id,
        name,
        description,
        price_cents,
        quantity_available,
        sales_start,
        sales_end,
        catering_included
      `)
      .eq("event_id", event.id)
      .eq("active", true)
      .order("price_cents", { ascending: true });

  if (ticketError) {
    console.error(ticketError);
    throw new Error("Unable to load ticket types.");
  }

  const now = new Date();

  const availableTicketTypes = (ticketTypes ?? []).filter(
    (ticket) => {
      const salesStarted =
        !ticket.sales_start ||
        new Date(ticket.sales_start) <= now;

      const salesNotEnded =
        !ticket.sales_end ||
        new Date(ticket.sales_end) >= now;

      const quantityAvailable =
        ticket.quantity_available === null ||
        ticket.quantity_available > 0;

      return (
        salesStarted &&
        salesNotEnded &&
        quantityAvailable
      );
    }
  );

  const startsAt = new Date(event.starts_at);

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-gray-500">
            Nerds of Darts
          </p>

          <h1 className="text-4xl font-bold sm:text-6xl">
            {event.name}
          </h1>

          {event.short_description && (
            <p className="mt-5 max-w-3xl text-xl text-gray-400">
              {event.short_description}
            </p>
          )}

          <div className="mt-8 grid gap-4 text-gray-300 sm:grid-cols-2">
            <div>
              <span className="text-sm text-gray-500">
                Date
              </span>

              <p className="mt-1 text-lg">
                {startsAt.toLocaleDateString("en-NL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div>
              <span className="text-sm text-gray-500">
                Location
              </span>

              <p className="mt-1 text-lg">
                {event.location_name || "Location announced soon"}

                {event.location_address && (
                  <span className="mt-1 block text-sm text-gray-500">
                   {event.location_address}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {event.description && (
          <section className="mb-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="mb-4 text-2xl font-bold">
              About this event
            </h2>

            <div className="max-w-4xl whitespace-pre-wrap leading-7 text-gray-300">
              {event.description}
            </div>
          </section>
        )}

        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-bold">
              Tickets
            </h2>

            <p className="mt-2 text-gray-400">
              Choose your tickets below.
            </p>
          </div>

          {availableTicketTypes.length > 0 ? (
            <TicketSelector
              eventId={event.id}
              ticketTypes={availableTicketTypes}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <h3 className="text-xl font-semibold">
                Tickets currently unavailable
              </h3>

              <p className="mt-2 text-gray-400">
                Check back later for ticket availability.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}