import { NextResponse } from "next/server";
import { kitPdf } from "@/features/creator-profile/pdf";
import { kitTokenPattern } from "@/features/creator-profile/rules";
import { profileApi, safePublic } from "@/server/profile/service";
export const dynamic = "force-dynamic";
// The PDF is built from exactly what the link allows at this moment (validity, recipient, item privacy and rates are re-checked).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!kitTokenPattern.test(token))
    return new NextResponse("Not found", { status: 404 });
  const r = await safePublic((c) => profileApi.publicKit(c, token));
  if (!r || !r.ok || r.value.status !== "ok" || !r.value.content)
    return new NextResponse("This link is not available", {
      status: r?.ok && r.value.status === "sign_in_required" ? 401 : 404,
    });
  return new NextResponse(kitPdf(r.value.content) as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="media-kit.pdf"',
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}
