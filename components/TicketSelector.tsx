"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TicketType = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  quantity_available: number | null;
  sales_start: string | null;
  sales_end: string | null;
  catering_included: boolean;
};

type Props = {
  eventId: string;
  ticketTypes: TicketType[];
};

export default function TicketSelector({
  eventId,
  ticketTypes,
}: Props) {
  const router = useRouter();

  const [quantities, setQuantities] = useState<
    Record<string, number>
  >({});

  function setQuantity(
    ticketTypeId: string,
    quantity: number
  ) {
    setQuantities((current) => ({
      ...current,
      [ticketTypeId]: Math.max(0, quantity),
    }));
  }

  const selectedItems = useMemo(
    () =>
      ticketTypes
        .map((ticket) => ({
          ticketTypeId: ticket.id,
          quantity: quantities[ticket.id] ?? 0,
        }))
        .filter((item) => item.quantity > 0),
    [ticketTypes, quantities]
  );

  const totalQuantity = selectedItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalCents = selectedItems.reduce(
    (sum, item) => {
      const ticket = ticketTypes.find(
        (ticket) => ticket.id === item.ticketTypeId
      );

      return (
        sum +
        (ticket?.price_cents ?? 0) * item.quantity
      );
    },
    0
  );

  function continueToCheckout() {
    if (selectedItems.length === 0) {
      return;
    }

    const items = selectedItems
      .map(
        (item) =>
          `${item.ticketTypeId}:${item.quantity}`
      )
      .join(",");

    router.push(
      `/checkout?event=${eventId}&items=${encodeURIComponent(
        items
      )}`
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {ticketTypes.map((ticket) => {
          const quantity =
            quantities[ticket.id] ?? 0;

          const maximum =
            ticket.quantity_available === null
              ? 20
              : Math.min(ticket.quantity_available, 20);

          return (
            <div
              key={ticket.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    {ticket.name}
                  </h3>

                  {ticket.description && (
                    <p className="mt-2 text-gray-400">
                      {ticket.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                    {ticket.catering_included && (
                      <span>
                        Catering included
                      </span>
                    )}

                    {ticket.quantity_available !== null && (
                      <span>
                        {ticket.quantity_available} available
                      </span>
                    )}
                  </div>

                  <p className="mt-4 text-2xl font-bold">
                    €{" "}
                    {(ticket.price_cents / 100).toFixed(
                      2
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        ticket.id,
                        quantity - 1
                      )
                    }
                    disabled={quantity === 0}
                    className="h-11 w-11 rounded-lg border border-white/20 text-xl disabled:opacity-30"
                  >
                    −
                  </button>

                  <span className="w-8 text-center text-lg font-semibold">
                    {quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setQuantity(
                        ticket.id,
                        quantity + 1
                      )
                    }
                    disabled={quantity >= maximum}
                    className="h-11 w-11 rounded-lg border border-white/20 text-xl disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalQuantity > 0 && (
        <div className="sticky bottom-4 mt-6 rounded-2xl border border-white/10 bg-zinc-900/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-400">
                {totalQuantity}{" "}
                {totalQuantity === 1
                  ? "ticket"
                  : "tickets"}
              </p>

              <p className="text-2xl font-bold">
                € {(totalCents / 100).toFixed(2)}
              </p>
            </div>

            <button
              type="button"
              onClick={continueToCheckout}
              className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-gray-200"
            >
              Continue to player details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}