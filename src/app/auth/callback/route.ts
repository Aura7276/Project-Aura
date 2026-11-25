import { NextResponse } from "next/server";
import { requestClient } from "@/server/database/client";
import { configured } from "@/server/auth/session";
import { callbackOrigin } from "@/features/auth/validation";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const ok =
    code &&
    configured() &&
    !(await (await requestClient()).auth.exchangeCodeForSession(code)).error;
  return NextResponse.redirect(
    new URL(ok ? "/account/continue" : "/login?notice=oauth", callbackOrigin()),
  );
}
