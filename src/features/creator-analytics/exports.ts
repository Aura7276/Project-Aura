// CSV and PDF generation without any new dependency. CSV cells that begin with a formula character are neutralized (spreadsheet injection).
export const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const ascii = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/÷/g, "/")
    .replace(/[^\x20-\x7e]/g, "?");
/** A small, valid, text-only PDF (Helvetica). Lines are wrapped at about 90 characters. */
export function toPdf(title: string, lines: string[]): Uint8Array {
  const wrapped: string[] = [];
  for (const raw of lines) {
    let l = ascii(raw);
    if (!l) {
      wrapped.push("");
      continue;
    }
    while (l.length > 90) {
      let cut = l.lastIndexOf(" ", 90);
      if (cut < 40) cut = 90;
      wrapped.push(l.slice(0, cut));
      l = l.slice(cut).trimStart();
    }
    wrapped.push(l);
  }
  const perPage = 48;
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += perPage)
    pages.push(wrapped.slice(i, i + perPage));
  if (!pages.length) pages.push([]);
  const objs: string[] = [];
  const add = (s: string) => {
    objs.push(s);
    return objs.length;
  };
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const bold = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  );
  const kids: number[] = [];
  pages.forEach((pl, pi) => {
    const content = ["BT"];
    let y = 800;
    if (pi === 0) {
      content.push(`/F2 16 Tf 50 ${y} Td (${esc(ascii(title))}) Tj`);
      y -= 26;
      content.push("/F1 10 Tf");
      content.push(`0 -26 Td`);
    } else {
      content.push("/F1 10 Tf 50 800 Td");
    }
    for (const l of pl) {
      content.push(`(${esc(l)}) Tj 0 -14 Td`);
    }
    content.push("ET");
    const stream = content.join("\n");
    const c = add(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
    kids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${c} 0 R >>`,
      ),
    );
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const x = out.length;
  out +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
