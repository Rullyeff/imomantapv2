/**
 * Shared auth guard for cron/webhook routes under /api/public/*.
 * Uses a server-only CRON_SECRET (never shipped to the client) instead of the
 * publishable Supabase key, which is public by design.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided =
    request.headers.get("x-cron-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided) return false;

  const a = new TextEncoder().encode(provided);
  const b = new TextEncoder().encode(secret);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
