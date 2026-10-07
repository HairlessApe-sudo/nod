import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fulfillOrder } from "@/lib/orders";

export async function POST(
  request: NextRequest
) {
  try {
    if (
      process.env.PAYMENT_PROVIDER !==
      "development"
    ) {
      return NextResponse.json(
        {
          error:
            "Development payments are disabled.",
        },
        { status: 403 }
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
          total_cents
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
            "This order is no longer pending.",
        },
        { status: 409 }
      );
    }

    const paidAt =
      new Date().toISOString();

    // --------------------------------------------------------
    // Mark order paid
    // --------------------------------------------------------

    const { error: orderUpdateError } =
      await supabaseAdmin
        .from("orders")
        .update({
          status: "paid",
          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq("id", order.id)
        .eq("status", "pending");

    if (orderUpdateError) {
      throw new Error(
        `Unable to mark order paid: ${orderUpdateError.message}`
      );
    }

    // --------------------------------------------------------
    // Record development payment
    // --------------------------------------------------------

    const fakePaymentId =
      `dev_${order.id}`;

    const { error: paymentError } =
      await supabaseAdmin
        .from("payments")
        .upsert(
          {
            order_id: order.id,
            provider: "development",
            method: "test",
            provider_payment_id:
              fakePaymentId,
            amount_cents:
              order.total_cents,
            provider_fee_cents: 0,
            customer_fee_cents: 0,
            status: "paid",
            paid_at: paidAt,
            metadata: {
              development: true,
              note:
                "Development payment. No real money was processed.",
            },
            updated_at: paidAt,
          },
          {
            onConflict:
              "provider_payment_id",
          }
        );

    if (paymentError) {
      throw new Error(
        `Unable to record payment: ${paymentError.message}`
      );
    }

    // --------------------------------------------------------
    // Fulfill order
    // --------------------------------------------------------

    const result =
      await fulfillOrder(order.id);

    return NextResponse.json({
      success: true,
      development: true,
      orderId: order.id,
      orderNumber:
        order.order_number,
      ticketCount:
        result.tickets.length,
    });
  } catch (error) {
    console.error(
      "Development payment error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}