import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

function hashClaimToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function generateClaimToken() {
  return randomBytes(32).toString("base64url");
}

export async function createTicketClaimToken(
  ticketId: string,
  expiresInDays = 30
) {
  const token = generateClaimToken();
  const tokenHash = hashClaimToken(token);

  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  );

  const { error } = await supabaseAdmin
    .from("tickets")
    .update({
      claim_token_hash: tokenHash,
      claim_token_created_at: new Date().toISOString(),
      claim_token_expires_at: expiresAt.toISOString(),
      claimed_at: null,
      claimed_by: null,
    })
    .eq("id", ticketId);

  if (error) {
    throw new Error(
      `Failed to create ticket claim token: ${error.message}`
    );
  }

  return {
    token,
    expiresAt,
  };
}