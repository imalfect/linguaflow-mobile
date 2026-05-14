import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { HttpError } from "./http.js";
import { env } from "./env.js";

interface SupabaseUser {
  id: string;
  email?: string;
  aud?: string;
  role?: string;
}

// Validates the Supabase JWT by asking Supabase to resolve it to a user.
// Avoids needing SUPABASE_JWT_SECRET (which isn't fetchable via the CLI)
// and stays correct across secret rotations.
export async function requireUser(event: APIGatewayProxyEventV2): Promise<{ userId: string; email?: string }> {
  const auth = event.headers?.authorization ?? event.headers?.Authorization;
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    throw new HttpError("Missing or malformed Authorization header", 401);
  }
  const token = auth.slice(7).trim();
  const supabaseUrl = env("SUPABASE_URL").replace(/\/$/, "");

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) throw new HttpError("Invalid or expired token", 401);
  if (!res.ok) {
    throw new HttpError(`Auth check failed: ${res.status}`, 502);
  }
  const user = (await res.json()) as SupabaseUser;
  if (!user?.id) throw new HttpError("Token resolves to no user", 401);
  return { userId: user.id, email: user.email };
}
