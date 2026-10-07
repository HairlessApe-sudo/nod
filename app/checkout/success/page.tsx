import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  let order:
    | {
        order_number: number;
        total_cents: number;
        customer_email: string;
      }
    | null = null;

  if (params.order) {
    const { data } = await supabase
      .from("orders")
      .select(`
        order_number,
        total_cents,
        customer_email
      `)
      .eq("id", params.order)
      .eq("status", "paid")
      .maybeSingle();

    order = data;
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-gray-500">
          Nerds of Darts
        </p>

        {order ? (
          <>
            <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20 text-3xl">
              ✓
            </div>

            <h1 className="mt-6 text-4xl font-bold">
              Order confirmed
            </h1>

            <p className="mt-4 text-lg text-gray-400">
              Your test order has been successfully
              processed.
            </p>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Order
                </span>

                <span className="font-semibold">
                  #{order.order_number}
                </span>
              </div>

              <div className="mt-4 flex justify-between">
                <span className="text-gray-500">
                  Total
                </span>

                <span className="font-semibold">
                  €
                  {(
                    order.total_cents /
                    100
                  ).toFixed(2)}
                </span>
              </div>

              <div className="mt-4">
                <span className="text-gray-500">
                  Confirmation
                </span>

                <p className="mt-1">
                  {order.customer_email}
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm text-gray-500">
              DEVELOPMENT MODE — no real payment was
              processed.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-4xl font-bold">
              Order not found
            </h1>

            <p className="mt-4 text-gray-400">
              We couldn't find the requested order.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-black"
        >
          Return to NOD
        </Link>
      </div>
    </main>
  );
}