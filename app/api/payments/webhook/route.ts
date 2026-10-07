import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createTicketForHolder } from "@/lib/tickets";

const MOLLIE_API_URL =
  "https://api.mollie.com/v2/payments";

type MolliePayment = {
  id: string;
  status: string;
  method?: string;
  amount: {
    currency: string;
    value: string;
  };
  paidAt?: string;
  metadata?: {
    order_id?: string;
    order_number?: string;
  };
};

function centsFromMollieValue(
  value: string
) {
  return Math.round(
    Number.parseFloat(value) * 100
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const mollieApiKey =
      process.env.MOLLIE_API_KEY;

    if (!mollieApiKey) {
      throw new Error(
        "Missing MOLLIE_API_KEY"
      );
    }

    // Mollie sends the payment ID as form data.
    const formData =
      await request.formData();

    const paymentId = String(
      formData.get("id") ?? ""
    ).trim();

    if (!paymentId) {
      return new NextResponse(
        "Missing payment ID",
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // IMPORTANT:
    // Fetch the payment directly from Mollie.
    // Never trust the webhook itself as proof of payment.
    // --------------------------------------------------------

    const mollieResponse = await fetch(
      `${MOLLIE_API_URL}/${encodeURIComponent(
        paymentId
      )}`,
      {
        headers: {
          Authorization: `Bearer ${mollieApiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!mollieResponse.ok) {
      console.error(
        "Unable to retrieve Mollie payment:",
        await mollieResponse.text()
      );

      return new NextResponse(
        "Unable to verify payment",
        { status: 502 }
      );
    }

    const payment =
      (await mollieResponse.json()) as MolliePayment;

    // --------------------------------------------------------
    // Find our order
    // --------------------------------------------------------

    const orderId =
      payment.metadata?.order_id;

    if (!orderId) {
      console.error(
        "Mollie payment has no NOD order ID:",
        paymentId
      );

      return new NextResponse(
        "Payment has no order reference",
        { status: 400 }
      );
    }

    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("orders")
        .select(`
          id,
          order_number,
          status,
          total_cents,
          mollie_payment_id
        `)
        .eq("id", orderId)
        .single();

    if (orderError || !order) {
      console.error(
        "NOD order not found:",
        orderId
      );

      return new NextResponse(
        "Order not found",
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // Store / update payment record
    // --------------------------------------------------------

    const paymentStatusMap: Record<
      string,
      string
    > = {
      open: "pending",
      pending: "pending",
      authorized: "paid",
      paid: "paid",
      failed: "failed",
      canceled: "cancelled",
      expired: "cancelled",
    };

    const localPaymentStatus =
      paymentStatusMap[payment.status] ??
      "pending";

    const amountCents =
      centsFromMollieValue(
        payment.amount.value
      );

    const { error: paymentUpsertError } =
      await supabaseAdmin
        .from("payments")
        .upsert(
          {
            order_id: order.id,
            provider: "mollie",
            method: payment.method ?? null,
            provider_payment_id:
              payment.id,
            amount_cents: amountCents,
            provider_fee_cents: 0,
            customer_fee_cents: 0,
            status: localPaymentStatus,
            paid_at:
              payment.paidAt ?? null,
            metadata: payment,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "provider_payment_id",
          }
        );

    if (paymentUpsertError) {
      console.error(
        paymentUpsertError
      );

      return new NextResponse(
        "Unable to record payment",
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Payment isn't successful yet.
    // Nothing else to do.
    // --------------------------------------------------------

    if (payment.status !== "paid") {
      return new NextResponse("OK", {
        status: 200,
      });
    }

    // --------------------------------------------------------
    // Verify the amount.
    // --------------------------------------------------------

    if (
      amountCents !== order.total_cents
    ) {
      console.error(
        "PAYMENT AMOUNT MISMATCH",
        {
          orderId: order.id,
          expected: order.total_cents,
          received: amountCents,
        }
      );

      return new NextResponse(
        "Payment amount mismatch",
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Idempotency:
    // If the order is already paid, do not issue tickets
    // again.
    // --------------------------------------------------------

    if (order.status === "paid") {
      return new NextResponse("OK", {
        status: 200,
      });
    }

    // --------------------------------------------------------
    // Mark order paid
    // --------------------------------------------------------

    const { error: orderUpdateError } =
      await supabaseAdmin
        .from("orders")
        .update({
          status: "paid",
          paid_at:
            payment.paidAt ??
            new Date().toISOString(),
          mollie_payment_id:
            payment.id,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");

    if (orderUpdateError) {
      console.error(
        orderUpdateError
      );

      return new NextResponse(
        "Unable to update order",
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Retrieve order holders
    // --------------------------------------------------------

    const { data: holders, error: holdersError } =
      await supabaseAdmin
        .from("order_holders")
        .select(`
          id,
          order_id,
          order_item_id,
          sequence_number,
          first_name,
          last_name,
          email,
          phone,
          dietary_requirements,
          is_purchaser
        `)
        .eq("order_id", order.id)
        .order("sequence_number", {
          ascending: true,
        });

    if (holdersError) {
      console.error(
        holdersError
      );

      return new NextResponse(
        "Unable to retrieve players",
        { status: 500 }
      );
    }

    if (!holders?.length) {
      console.error(
        "Paid order has no holders:",
        order.id
      );

      return new NextResponse(
        "Paid order has no players",
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Retrieve order items so we know event/ticket type.
    // --------------------------------------------------------

    const { data: orderItems, error: itemsError } =
      await supabaseAdmin
        .from("order_items")
        .select(`
          id,
          order_id,
          ticket_type_id,
          quantity
        `)
        .eq("order_id", order.id);

    if (itemsError) {
      console.error(itemsError);

      return new NextResponse(
        "Unable to retrieve order items",
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Retrieve ticket types / events
    // --------------------------------------------------------

    const ticketTypeIds =
      orderItems?.map(
        (item) => item.ticket_type_id
      ) ?? [];

    const { data: ticketTypes, error: ticketTypesError } =
      await supabaseAdmin
        .from("ticket_types")
        .select(`
          id,
          event_id
        `)
        .in("id", ticketTypeIds);

    if (ticketTypesError) {
      console.error(
        ticketTypesError
      );

      return new NextResponse(
        "Unable to retrieve ticket types",
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Create tickets.
    //
    // Before creating each ticket we check whether this
    // order item/holder combination already exists.
    // --------------------------------------------------------

    for (const holder of holders) {
      const orderItem =
        orderItems?.find(
          (item) =>
            item.id ===
            holder.order_item_id
        );

      if (!orderItem) {
        throw new Error(
          `Missing order item for holder ${holder.id}`
        );
      }

      const ticketType =
        ticketTypes?.find(
          (ticket) =>
            ticket.id ===
            orderItem.ticket_type_id
        );

      if (!ticketType) {
        throw new Error(
          `Missing ticket type for order item ${orderItem.id}`
        );
      }

      // Check whether this holder already has a ticket.
      const { data: existingTicket } =
        await supabaseAdmin
          .from("tickets")
          .select("id")
          .eq("order_id", order.id)
          .eq(
            "order_item_id",
            holder.order_item_id
          )
          .eq(
            "holder_first_name",
            holder.first_name
          )
          .eq(
            "holder_last_name",
            holder.last_name
          )
          .maybeSingle();

      if (existingTicket) {
        continue;
      }

      await createTicketForHolder({
        orderId: order.id,
        orderItemId:
          holder.order_item_id,
        ticketTypeId:
          ticketType.id,
        eventId:
          ticketType.event_id,
        holder: {
          firstName:
            holder.first_name,
          lastName:
            holder.last_name,
          email:
            holder.email ?? undefined,
          phone:
            holder.phone ?? undefined,
          dietaryRequirements:
            holder.dietary_requirements,
          isPurchaser:
            holder.is_purchaser,
        },
      });
    }

    return new NextResponse("OK", {
      status: 200,
    });
  } catch (error) {
    console.error(
      "Mollie webhook error:",
      error
    );

    return new NextResponse(
      "Webhook processing failed",
      { status: 500 }
    );
  }
}