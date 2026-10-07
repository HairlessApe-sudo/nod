import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const MOLLIE_API_URL = "https://api.mollie.com/v2/payments";

type MolliePaymentResponse = {
  id: string;
  status: string;
  amount: {
    currency: string;
    value: string;
  };
  _links?: {
    checkout?: {
      href?: string;
    };
  };
};

export async function POST(
  request: NextRequest
) {
  try {
    const mollieApiKey =
      process.env.MOLLIE_API_KEY;

    const siteUrl =
      process.env.NOD_SITE_URL;

    if (!mollieApiKey) {
      throw new Error(
        "Missing MOLLIE_API_KEY"
      );
    }

    if (!siteUrl) {
      throw new Error(
        "Missing NOD_SITE_URL"
      );
    }

    const body = await request.json();

    const orderId = String(
      body.orderId ?? ""
    ).trim();

    if (!orderId) {
      return NextResponse.json(
        { error: "Missing order ID." },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Load order
    // --------------------------------------------------------

    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          currency,
          subtotal_cents,
          payment_fee_cents,
          discount_cents,
          total_cents,
          customer_email,
          mollie_payment_id,
          expires_at
        `)
        .eq("id", orderId)
        .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        {
          error:
            "This order is no longer available for payment.",
        },
        { status: 409 }
      );
    }

    if (
      order.expires_at &&
      new Date(order.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "This order has expired." },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // Don't create a second Mollie payment if one already
    // exists for this order.
    // --------------------------------------------------------

    if (order.mollie_payment_id) {
      const existingResponse = await fetch(
        `${MOLLIE_API_URL}/${order.mollie_payment_id}`,
        {
          headers: {
            Authorization: `Bearer ${mollieApiKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (existingResponse.ok) {
        const existing =
          (await existingResponse.json()) as MolliePaymentResponse;

        const checkoutUrl =
          existing._links?.checkout?.href;

        if (checkoutUrl) {
          return NextResponse.json({
            success: true,
            paymentId: existing.id,
            checkoutUrl,
          });
        }
      }
    }

    // --------------------------------------------------------
    // Mollie expects decimal EUR amounts.
    // --------------------------------------------------------

    const amount = (
      order.total_cents / 100
    ).toFixed(2);

    const redirectUrl =
      `${siteUrl}/checkout/return?order=${encodeURIComponent(
        order.id
      )}`;

    const webhookUrl =
      `${siteUrl}/api/payments/webhook`;

    // --------------------------------------------------------
    // Create Mollie payment
    // --------------------------------------------------------

    const mollieResponse = await fetch(
      MOLLIE_API_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mollieApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: {
            currency: order.currency,
            value: amount,
          },

          description:
            `NOD Order #${order.order_number}`,

          redirectUrl,
          cancelUrl: redirectUrl,
          webhookUrl,

          metadata: {
            order_id: order.id,
            order_number: String(
              order.order_number
            ),
          },
        }),
      }
    );

    const mollieData =
      await mollieResponse.json();

    if (!mollieResponse.ok) {
      console.error(
        "Mollie payment creation failed:",
        mollieData
      );

      return NextResponse.json(
        {
          error:
            mollieData?.detail ||
            "Mollie could not create the payment.",
        },
        { status: 502 }
      );
    }

    const payment =
      mollieData as MolliePaymentResponse;

    const checkoutUrl =
      payment._links?.checkout?.href;

    if (!checkoutUrl) {
      return NextResponse.json(
        {
          error:
            "Mollie created the payment but returned no checkout URL.",
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------------
    // Save Mollie payment ID on our order
    // --------------------------------------------------------

    const { error: updateError } =
      await supabaseAdmin
        .from("orders")
        .update({
          mollie_payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .is("mollie_payment_id", null);

    if (updateError) {
      console.error(updateError);

      return NextResponse.json(
        {
          error:
            "Payment was created but the order could not be updated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      checkoutUrl,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}