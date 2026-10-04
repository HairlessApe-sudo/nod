import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type IncomingItem = {
  ticketTypeId: string;
  quantity: number;
};

type IncomingHolder = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dietaryRequirements?: string;
  isPurchaser?: boolean;
};

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const eventId = String(body.eventId ?? "");
    const customerEmail = String(
      body.customerEmail ?? ""
    )
      .trim()
      .toLowerCase();

    const customerPhone = String(
      body.customerPhone ?? ""
    ).trim();

    const items =
      (body.items ?? []) as IncomingItem[];

    const holders =
      (body.holders ?? []) as IncomingHolder[];

    if (!eventId) {
      return NextResponse.json(
        { error: "Missing event." },
        { status: 400 }
      );
    }

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Purchaser email is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No tickets selected." },
        { status: 400 }
      );
    }

    if (!Array.isArray(holders)) {
      return NextResponse.json(
        { error: "Invalid player details." },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Load and validate the event
    // --------------------------------------------------------

    const { data: event, error: eventError } =
      await supabaseAdmin
        .from("events")
        .select("id, name, status")
        .eq("id", eventId)
        .eq("status", "published")
        .maybeSingle();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event is not available." },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // Load ticket types directly from the database.
    //
    // Never trust prices sent by the browser.
    // --------------------------------------------------------

    const ticketTypeIds = items.map(
      (item) => item.ticketTypeId
    );

    const { data: ticketTypes, error: ticketError } =
      await supabaseAdmin
        .from("ticket_types")
        .select(`
          id,
          event_id,
          name,
          price_cents,
          quantity_available,
          sales_start,
          sales_end,
          active
        `)
        .eq("event_id", eventId)
        .eq("active", true)
        .in("id", ticketTypeIds);

    if (ticketError) {
      console.error(ticketError);

      return NextResponse.json(
        { error: "Unable to validate tickets." },
        { status: 500 }
      );
    }

    if (
      !ticketTypes ||
      ticketTypes.length !== ticketTypeIds.length
    ) {
      return NextResponse.json(
        { error: "One or more tickets are invalid." },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Validate quantities and sales windows
    // --------------------------------------------------------

    const now = new Date();

    for (const item of items) {
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      ) {
        return NextResponse.json(
          {
            error:
              "Ticket quantities must be between 1 and 20.",
          },
          { status: 400 }
        );
      }

      const ticket = ticketTypes.find(
        (candidate) =>
          candidate.id === item.ticketTypeId
      );

      if (!ticket) {
        return NextResponse.json(
          { error: "Invalid ticket type." },
          { status: 400 }
        );
      }

      if (
        ticket.sales_start &&
        new Date(ticket.sales_start) > now
      ) {
        return NextResponse.json(
          {
            error: `${ticket.name} is not on sale yet.`,
          },
          { status: 400 }
        );
      }

      if (
        ticket.sales_end &&
        new Date(ticket.sales_end) < now
      ) {
        return NextResponse.json(
          {
            error: `${ticket.name} is no longer on sale.`,
          },
          { status: 400 }
        );
      }

      if (
        ticket.quantity_available !== null &&
        item.quantity > ticket.quantity_available
      ) {
        return NextResponse.json(
          {
            error: `Only ${ticket.quantity_available} ${ticket.name} tickets are available.`,
          },
          { status: 400 }
        );
      }
    }

    const totalQuantity = items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (holders.length !== totalQuantity) {
      return NextResponse.json(
        {
          error:
            "The number of player records does not match the number of tickets.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // Calculate price from database values
    // --------------------------------------------------------

    const subtotalCents = items.reduce(
      (sum, item) => {
        const ticket = ticketTypes.find(
          (candidate) =>
            candidate.id === item.ticketTypeId
        );

        return (
          sum +
          (ticket?.price_cents ?? 0) *
            item.quantity
        );
      },
      0
    );

    // Payment fees will be added when a payment method
    // is selected.
    const paymentFeeCents = 0;
    const discountCents = 0;

    const totalCents =
      subtotalCents +
      paymentFeeCents -
      discountCents;

    // --------------------------------------------------------
    // Create pending order
    // --------------------------------------------------------

    const { data: order, error: orderError } =
      await supabaseAdmin
        .from("orders")
        .insert({
          status: "pending",
          currency: "EUR",

          subtotal_cents: subtotalCents,
          payment_fee_cents: paymentFeeCents,
          discount_cents: discountCents,
          total_cents: totalCents,

          customer_email: customerEmail,
          customer_phone: customerPhone || null,

          expires_at: new Date(
            Date.now() + 30 * 60 * 1000
          ).toISOString(),
        })
        .select("id, order_number")
        .single();

    if (orderError || !order) {
      console.error(orderError);

      return NextResponse.json(
        { error: "Unable to create order." },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Create order items
    // --------------------------------------------------------

    const orderItems = [];

    for (const item of items) {
      const ticket = ticketTypes.find(
        (candidate) =>
          candidate.id === item.ticketTypeId
      );

      if (!ticket) {
        throw new Error("Ticket type disappeared.");
      }

      const { data: orderItem, error } =
        await supabaseAdmin
          .from("order_items")
          .insert({
            order_id: order.id,
            ticket_type_id: ticket.id,
            quantity: item.quantity,
            unit_price_cents: ticket.price_cents,
          })
          .select("id, ticket_type_id, quantity")
          .single();

      if (error || !orderItem) {
        throw new Error(
          error?.message ??
            "Unable to create order item."
        );
      }

      orderItems.push(orderItem);
    }

    // --------------------------------------------------------
    // Map holders to order items.
    //
    // For now we assign holders sequentially to the
    // selected ticket types.
    // --------------------------------------------------------

    let holderIndex = 0;

    for (const orderItem of orderItems) {
      for (
        let itemIndex = 0;
        itemIndex < orderItem.quantity;
        itemIndex++
      ) {
        const holder = holders[holderIndex];

        if (!holder) {
          throw new Error(
            "Missing ticket holder."
          );
        }

        const firstName = String(
          holder.firstName ?? ""
        ).trim();

        const lastName = String(
          holder.lastName ?? ""
        ).trim();

        if (!firstName || !lastName) {
          throw new Error(
            `Player ${holderIndex + 1} requires a first and last name.`
          );
        }

        const email =
          String(holder.email ?? "")
            .trim()
            .toLowerCase() || null;

        const phone =
          String(holder.phone ?? "").trim() ||
          null;

        const dietaryRequirements =
          String(
            holder.dietaryRequirements ?? ""
          ).trim() || "No restrictions";

        const { error: holderError } =
          await supabaseAdmin
            .from("order_holders")
            .insert({
              order_id: order.id,
              order_item_id: orderItem.id,
              sequence_number: holderIndex + 1,

              first_name: firstName,
              last_name: lastName,
              email,
              phone,

              dietary_requirements:
                dietaryRequirements,

              is_purchaser:
                holder.isPurchaser === true,
            });

        if (holderError) {
          throw new Error(
            holderError.message
          );
        }

        holderIndex++;
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      subtotalCents,
      totalCents,
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