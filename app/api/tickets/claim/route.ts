import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

function hashClaimToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const accessToken = authorization.substring("Bearer ".length);

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired login session." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const token = String(body.token ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Missing ticket claim token." },
        { status: 400 }
      );
    }

    const tokenHash = hashClaimToken(token);

    const {
      data: ticket,
      error: ticketError,
    } = await supabaseAdmin
      .from("tickets")
      .select(`
        id,
        ticket_number,
        event_id,
        holder_id,
        holder_email,
        claimed_at,
        claim_token_expires_at,
        people:holder_id (
          id,
          first_name,
          last_name,
          email
        ),
        events:event_id (
          id,
          name,
          starts_at,
          ends_at
        )
      `)
      .eq("claim_token_hash", tokenHash)
      .maybeSingle();

    if (ticketError) {
      console.error(ticketError);

      return NextResponse.json(
        { error: "Unable to find ticket." },
        { status: 500 }
      );
    }

    if (!ticket) {
      return NextResponse.json(
        { error: "This ticket claim link is invalid." },
        { status: 404 }
      );
    }

    if (ticket.claimed_at) {
      return NextResponse.json(
        { error: "This ticket has already been claimed." },
        { status: 409 }
      );
    }

    if (
      ticket.claim_token_expires_at &&
      new Date(ticket.claim_token_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "This ticket claim link has expired." },
        { status: 410 }
      );
    }

    // --------------------------------------------------------
    // Find the signed-in player's profile
    // --------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("id, person_id, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Your NOD profile could not be found." },
        { status: 404 }
      );
    }

    // --------------------------------------------------------
    // Prevent an account from silently taking ownership of
    // multiple unrelated player records.
    // --------------------------------------------------------

    if (
      profile.person_id &&
      profile.person_id !== ticket.holder_id
    ) {
      return NextResponse.json(
        {
          error:
            "Your NOD account is already linked to another player record.",
        },
        { status: 409 }
      );
    }

    // --------------------------------------------------------
    // Link account -> player
    // --------------------------------------------------------

    const { error: profileUpdateError } = await supabaseAdmin
      .from("profiles")
      .update({
        person_id: ticket.holder_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileUpdateError) {
      console.error(profileUpdateError);

      return NextResponse.json(
        { error: "Unable to link your NOD account." },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // Mark ticket as claimed and invalidate token
    // --------------------------------------------------------

    const { error: ticketUpdateError } = await supabaseAdmin
      .from("tickets")
      .update({
        claimed_at: new Date().toISOString(),
        claimed_by: user.id,
        claim_token_hash: null,
        claim_token_created_at: null,
        claim_token_expires_at: null,
      })
      .eq("id", ticket.id)
      .is("claimed_at", null);

    if (ticketUpdateError) {
      console.error(ticketUpdateError);

      return NextResponse.json(
        {
          error:
            "Your account was linked, but the ticket could not be finalized.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        event: ticket.events,
        player: ticket.people,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}