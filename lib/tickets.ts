import { supabaseAdmin } from "@/lib/supabase-admin";
import { createTicketClaimToken } from "@/lib/ticket-claims";

export type TicketHolderInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dietaryRequirements?: string;
  isPurchaser?: boolean;
};

export async function createTicketForHolder({
  orderId,
  orderItemId,
  ticketTypeId,
  eventId,
  holder,
}: {
  orderId: string;
  orderItemId: string;
  ticketTypeId: string;
  eventId: string;
  holder: TicketHolderInput;
}) {
  const firstName = holder.firstName.trim();
  const lastName = holder.lastName.trim();

  if (!firstName || !lastName) {
    throw new Error("Player first and last name are required.");
  }

  const email = holder.email?.trim().toLowerCase() || null;
  const phone = holder.phone?.trim() || null;

  // ----------------------------------------------------------
  // Create a player record.
  //
  // We deliberately do NOT automatically match an existing
  // person by email. The player can claim/link their account
  // later using the secure ticket claim process.
  // ----------------------------------------------------------

  const { data: person, error: personError } =
    await supabaseAdmin
      .from("people")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        person_type: "player",
      })
      .select("id")
      .single();

  if (personError || !person) {
    throw new Error(
      `Could not create player: ${
        personError?.message ?? "Unknown error"
      }`
    );
  }

  // ----------------------------------------------------------
  // Create the ticket
  // ----------------------------------------------------------

  const { data: ticket, error: ticketError } =
    await supabaseAdmin
      .from("tickets")
      .insert({
        order_id: orderId,
        order_item_id: orderItemId,
        ticket_type_id: ticketTypeId,
        event_id: eventId,

        holder_id: person.id,
        holder_first_name: firstName,
        holder_last_name: lastName,
        holder_email: email,
        holder_phone: phone,

        dietary_requirements:
          holder.dietaryRequirements?.trim() ||
          "No restrictions",

        status: "valid",
      })
      .select(`
        id,
        ticket_number,
        event_id,
        holder_id,
        holder_email,
        dietary_requirements,
        status
      `)
      .single();

  if (ticketError || !ticket) {
    // Clean up the person record because ticket creation failed.
    await supabaseAdmin
      .from("people")
      .delete()
      .eq("id", person.id);

    throw new Error(
      `Could not create ticket: ${
        ticketError?.message ?? "Unknown error"
      }`
    );
  }

  // ----------------------------------------------------------
  // Generate secure claim token
  // ----------------------------------------------------------

  const claim = await createTicketClaimToken(ticket.id);

  return {
    ticket,
    personId: person.id,
    claimToken: claim.token,
    claimExpiresAt: claim.expiresAt,
  };
}