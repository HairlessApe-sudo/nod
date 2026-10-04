import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CheckoutForm from "@/components/CheckoutForm";

type PageProps = {
  searchParams: Promise<{
    event?: string;
    items?: string;
  }>;
};

type SelectedItem = {
  ticketTypeId: string;
  quantity: number;
};

function parseItems(value?: string): SelectedItem[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => {
      const [ticketTypeId, quantityText] =
        part.split(":");

      const quantity = Number(quantityText);

      if (
        !ticketTypeId ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return null;
      }

      return {
        ticketTypeId,
        quantity,
      };
    })
    .filter(
      (item): item is SelectedItem => item !== null
    );
}

export default async function CheckoutPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const eventId = params.event;
  const selectedItems = parseItems(params.items);

  if (!eventId || selectedItems.length === 0) {
    redirect("/");
  }

  const ticketTypeIds = selectedItems.map(
    (item) => item.ticketTypeId
  );

  const { data: event, error: eventError } =
    await supabase
      .from("events")
      .select(
        "id, name, location, starts_at, status"
      )
      .eq("id", eventId)
      .eq("status", "published")
      .maybeSingle();

  if (eventError) {
    throw new Error(eventError.message);
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
        catering_included
      `)
      .eq("event_id", eventId)
      .eq("active", true)
      .in("id", ticketTypeIds);

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  if (!ticketTypes || ticketTypes.length !== ticketTypeIds.length) {
    notFound();
  }

  const items = selectedItems.map((item) => {
    const ticketType = ticketTypes.find(
      (ticket) => ticket.id === item.ticketTypeId
    );

    if (!ticketType) {
      throw new Error("Invalid ticket selection.");
    }

    return {
      ticketTypeId: ticketType.id,
      name: ticketType.name,
      priceCents: ticketType.price_cents,
      quantity: item.quantity,
      cateringIncluded:
        ticketType.catering_included,
    };
  });

  const totalQuantity = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const subtotalCents = items.reduce(
    (sum, item) =>
      sum +
      item.priceCents * item.quantity,
    0
  );

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-gray-500">
          Nerds of Darts
        </p>

        <h1 className="text-4xl font-bold">
          Player details
        </h1>

        <p className="mt-3 text-gray-400">
          {event.name}
        </p>

        <div className="mt-10">
          <CheckoutForm
            eventId={event.id}
            items={items}
            totalQuantity={totalQuantity}
            subtotalCents={subtotalCents}
          />
        </div>
      </div>
    </main>
  );
}