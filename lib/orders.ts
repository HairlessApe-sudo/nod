import { supabaseAdmin } from "@/lib/supabase-admin";
import { createTicketForHolder } from "@/lib/tickets";

export async function fulfillOrder(
  orderId: string
) {
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
        total_cents,
        currency
      `)
      .eq("id", orderId)
      .single();

  if (orderError || !order) {
    throw new Error(
      `Order not found: ${orderId}`
    );
  }

  if (order.status !== "paid") {
    throw new Error(
      `Order ${order.order_number} is not paid.`
    );
  }

  // --------------------------------------------------------
  // Load order items
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
    throw new Error(
      `Unable to load order items: ${itemsError.message}`
    );
  }

  if (!orderItems?.length) {
    throw new Error(
      `Order ${order.order_number} has no order items.`
    );
  }

  // --------------------------------------------------------
  // Load holders
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
    throw new Error(
      `Unable to load order holders: ${holdersError.message}`
    );
  }

  if (!holders?.length) {
    throw new Error(
      `Order ${order.order_number} has no players.`
    );
  }

  // --------------------------------------------------------
  // Verify ticket count
  // --------------------------------------------------------

  const expectedTicketCount =
    orderItems.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  if (
    holders.length !==
    expectedTicketCount
  ) {
    throw new Error(
      `Order ${order.order_number} expects ${expectedTicketCount} players but has ${holders.length}.`
    );
  }

  // --------------------------------------------------------
  // Load ticket types
  // --------------------------------------------------------

  const ticketTypeIds =
    orderItems.map(
      (item) => item.ticket_type_id
    );

  const { data: ticketTypes, error: ticketTypesError } =
    await supabaseAdmin
      .from("ticket_types")
      .select(`
        id,
        event_id
      `)
      .in("id", ticketTypeIds);

  if (ticketTypesError) {
    throw new Error(
      `Unable to load ticket types: ${ticketTypesError.message}`
    );
  }

  if (!ticketTypes?.length) {
    throw new Error(
      `No ticket types found for order ${order.order_number}.`
    );
  }

  // --------------------------------------------------------
  // Create tickets
  // --------------------------------------------------------

  const tickets = [];

  for (const holder of holders) {
    const orderItem =
      orderItems.find(
        (item) =>
          item.id ===
          holder.order_item_id
      );

    if (!orderItem) {
      throw new Error(
        `Holder ${holder.id} references missing order item.`
      );
    }

    const ticketType =
      ticketTypes.find(
        (ticket) =>
          ticket.id ===
          orderItem.ticket_type_id
      );

    if (!ticketType) {
      throw new Error(
        `Order item ${orderItem.id} references missing ticket type.`
      );
    }

    // ------------------------------------------------------
    // Idempotency
    //
    // If fulfillment runs twice, don't create duplicate
    // tickets.
    // ------------------------------------------------------

    const { data: existingTickets, error: existingError } =
      await supabaseAdmin
        .from("tickets")
        .select(`
          id,
          ticket_number,
          holder_first_name,
          holder_last_name
        `)
        .eq("order_id", order.id)
        .eq(
          "order_item_id",
          orderItem.id
        );

    if (existingError) {
      throw new Error(
        `Unable to check existing tickets: ${existingError.message}`
      );
    }

    const alreadyExists =
      existingTickets?.some(
        (ticket) =>
          ticket.holder_first_name ===
            holder.first_name &&
          ticket.holder_last_name ===
            holder.last_name
      );

    if (alreadyExists) {
      const existing =
        existingTickets?.find(
          (ticket) =>
            ticket.holder_first_name ===
              holder.first_name &&
            ticket.holder_last_name ===
              holder.last_name
        );

      if (existing) {
        tickets.push(existing);
      }

      continue;
    }

    const result =
      await createTicketForHolder({
        orderId: order.id,
        orderItemId:
          orderItem.id,
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

    tickets.push(
      result.ticket
    );
  }

  return {
    order,
    tickets,
  };
}