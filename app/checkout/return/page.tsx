import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    order?: string;
  }>;
};

export default async function CheckoutReturnPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#09090b] px-6 py-16 text-white">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-gray-500">
          Nerds of Darts
        </p>

        <h1 className="mt-6 text-4xl font-bold">
          Thanks for your order
        </h1>

        <p className="mt-4 text-lg text-gray-400">
          We're confirming your payment.
        </p>

        {params.order && (
          <p className="mt-4 text-sm text-gray-500">
            Order reference: {params.order}
          </p>
        )}

        <p className="mx-auto mt-8 max-w-lg text-gray-400">
          Your tickets will only be issued once the
          payment has been confirmed.
        </p>

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