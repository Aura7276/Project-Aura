import { NextResponse, type NextRequest } from "next/server";
import { brandContext } from "@/server/market/service";
import { monitor } from "@/server/monitor/service";
import { rateLimited } from "@/server/security/rate-limit";
import { reportCsv, reportLines } from "@/features/monitor/rules";
import { toPdf } from "@/features/creator-analytics/exports";

export const dynamic = "force-dynamic";
const uuidRe = /^[0-9a-f-]{36}$/i;
/** Report export. Permission is re-checked and logged by the database on every download (a Creator who withdrew figures blocks it). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> },
) {
  const { rid } = await params;
  const format = req.nextUrl.searchParams.get("format");
  const w = req.nextUrl.searchParams.get("w") ?? undefined;
  if (!uuidRe.test(rid) || (format !== "csv" && format !== "pdf"))
    return NextResponse.json(
      { error: "Invalid export request" },
      { status: 400 },
    );
  const b = await brandContext(w && uuidRe.test(w) ? w : undefined);
  if (rateLimited("report-export:" + b.userId, 30))
    return NextResponse.json(
      { error: "Too many exports. Please wait." },
      { status: 429 },
    );
  const r = await monitor.report(
    b.client,
    b.workspaceId,
    rid,
    format === "csv" ? "export_csv" : "export_pdf",
  );
  if (!r.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (r.value.blocked)
    return NextResponse.json({ error: r.value.reason }, { status: 403 });
  const x = r.value;
  const base = `${x.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v${x.version}`;
  if (format === "csv")
    return new NextResponse(reportCsv(x.snapshot, x.sections), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${base}.csv"`,
        "cache-control": "no-store",
      },
    });
  const pdf = toPdf(
    x.name,
    reportLines(x.snapshot.campaign.title, x.snapshot, x.sections, {
      name: x.name,
      version: x.version,
    }),
  );
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${base}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
