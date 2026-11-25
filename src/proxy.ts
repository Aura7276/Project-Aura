import { NextResponse, type NextRequest } from "next/server";
import { providerConfig } from "@/config/environment";
export function proxy(request: NextRequest) {
  const dev = process.env.NODE_ENV === "development";
  const nonce = btoa(crypto.randomUUID());
  const provider = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(providerConfig().url).origin
    : "";
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${dev ? "'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${provider} ${dev ? "ws://127.0.0.1:* ws://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response =
    !dev &&
    ["/dev/", "/readiness/"].some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
      ? new NextResponse("Not found", { status: 404 })
      : NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-Frame-Options", "DENY");
  if (!dev && request.nextUrl.protocol === "https:")
    response.headers.set("Strict-Transport-Security", "max-age=31536000");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
