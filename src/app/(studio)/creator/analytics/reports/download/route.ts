import { NextResponse, type NextRequest } from "next/server";
import { studioContext } from "@/server/studio/service";
import { analytics } from "@/server/analytics/service";
import { rateLimited } from "@/server/security/rate-limit";
import { buildExport } from "@/features/creator-analytics/export-data";
import { exportSchema } from "@/features/creator-analytics/schemas";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const p = exportSchema.safeParse(q);
  if (!p.success)
    return NextResponse.json(
      { error: "Invalid export request" },
      { status: 400 },
    );
  const ctx = await studioContext(); // authentication, Creator workspace and activation are enforced here and again in the database
  if (rateLimited("export:" + ctx.userId, 20))
    return NextResponse.json(
      { error: "Too many exports. Please wait." },
      { status: 429 },
    );
  // Permission and purpose are checked and logged by the database at the moment of export, before any data is read.
  const auth = await analytics.authorizeExport(
    ctx.client,
    ctx.workspaceId,
    p.data.kind,
    p.data.format,
    p.data.purpose,
  );
  if (!auth.ok)
    return NextResponse.json(
      { error: "Not permitted" },
      { status: auth.error === "denied" ? 403 : 400 },
    );
  const file = await buildExport(
    ctx,
    p.data.kind,
    p.data.format,
    typeof q.range === "string" ? q.range : "30d",
    p.data.purpose,
  );
  return new NextResponse(file.body as BodyInit, {
    headers: {
      "content-type": file.type,
      "content-disposition": `attachment; filename="${file.name}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
