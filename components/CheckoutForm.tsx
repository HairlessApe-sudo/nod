"use client";

import { useState } from "react";
import TicketHolderList, {
  type TicketHolder,
} from "@/components/TicketHolderList";

type CheckoutItem = {
  ticketTypeId: string;
  name: string;
  priceCents: number;
  quantity: number;
  cateringIncluded: boolean;
};

type Props = {
  eventId: string;
  items: CheckoutItem[];
  totalQuantity: number;
  subtotalCents: number;
};

export default function CheckoutForm({
  eventId,
  items,
  totalQuantity,
  subtotalCents,
}: Props) {
  const [customerEmail, setCustomerEmail] =
    useState("");

  const [customerPhone, setCustomerPhone] =
    useState("");

  const [holders, setHolders] = useState<
    TicketHolder[]
  >([]);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null
  );

  const [success, setSuccess] = useState<{
    orderNumber: number;
  } | null>(null);

  async function submitOrder(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      if (!customerEmail.trim()) {
        throw new Error(
          "A purchaser email address is required."
        );
      }

      if (holders.length !== totalQuantity) {
        throw new Error(
          "Please provide details for every player."
        );
      }

      const response = await fetch(
        "/api/orders/draft",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventId,
            customerEmail,
            customerPhone,
            items,
            holders,
          }),
        }
      );

const result = await response.json();

if (!response.ok) {
  throw new Error(
    result.error ||
      "Unable to create your order."
  );
}

// --------------------------------------------------
// Create Mollie payment
// --------------------------------------------------

const paymentResponse = await fetch(
  "/api/payments/development",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId: result.orderId,
    }),
  }
);

const paymentResult =
  await paymentResponse.json();

if (!paymentResponse.ok) {
  throw new Error(
    paymentResult.error ||
      "Unable to complete development payment."
  );
}

window.location.href =
  `/checkout/success?order=${encodeURIComponent(
    paymentResult.orderId
  )}`;

if (!paymentResult.checkoutUrl) {
  throw new Error(
    "Mollie did not return a checkout URL."
  );
}

// Send the customer to Mollie.
window.location.href =
  paymentResult.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <h2 className="text-2xl font-bold">
          Order created
        </h2>

        <p className="mt-3 text-gray-400">
          Your NOD order number is:
        </p>

        <p className="mt-2 text-3xl font-bold">
          #{success.orderNumber}
        </p>

        <p className="mt-6 text-gray-400">
          Payment integration comes next. No tickets
          have been issued yet.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitOrder}
      className="space-y-10"
    >
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <h2 className="text-2xl font-bold">
          Purchaser
        </h2>

        <p className="mt-2 text-gray-400">
          This is the person responsible for the
          order and payment.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Email *
            </label>

            <input
              type="email"
              required
              value={customerEmail}
              onChange={(event) =>
                setCustomerEmail(event.target.value)
              }
              className="w-full rounded-lg bg-white px-4 py-3 text-black outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Phone
            </label>

            <input
              type="tel"
              value={customerPhone}
              onChange={(event) =>
                setCustomerPhone(event.target.value)
              }
              className="w-full rounded-lg bg-white px-4 py-3 text-black outline-none"
              placeholder="06..."
            />
          </div>
        </div>
      </section>

      <TicketHolderList
        quantity={totalQuantity}
        onChange={setHolders}
      />

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <h2 className="text-2xl font-bold">
          Order summary
        </h2>

        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.ticketTypeId}
              className="flex justify-between gap-4 text-gray-300"
            >
              <span>
                {item.quantity} × {item.name}
              </span>

              <span>
                €
                {(
                  (item.priceCents *
                    item.quantity) /
                  100
                ).toFixed(2)}
              </span>
            </div>
          ))}

          <div className="border-t border-white/10 pt-4">
            <div className="flex justify-between text-xl font-bold">
              <span>Subtotal</span>

              <span>
                €{(subtotalCents / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-white px-6 py-4 text-lg font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Creating order..."
          : "Continue to payment"}
      </button>
    </form>
  );
}