// Dependency-free QR Code encoder (ISO/IEC 18004): byte mode, error correction level M, versions 1 to 10 (up to 213 bytes).
// Output is a boolean matrix (true = dark). Verified module-for-module against a reference encoder in tests.
const EC_M: Record<number, { ec: number; blocks: number[] }> = {
  1: { ec: 10, blocks: [16] },
  2: { ec: 16, blocks: [28] },
  3: { ec: 26, blocks: [44] },
  4: { ec: 18, blocks: [32, 32] },
  5: { ec: 24, blocks: [43, 43] },
  6: { ec: 16, blocks: [27, 27, 27, 27] },
  7: { ec: 18, blocks: [31, 31, 31, 31] },
  8: { ec: 22, blocks: [38, 38, 39, 39] },
  9: { ec: 22, blocks: [36, 36, 36, 37, 37] },
  10: { ec: 26, blocks: [43, 43, 43, 43, 44] },
};
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};
const EXP = new Uint8Array(512),
  LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
function generator(n: number): number[] {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    g.forEach((c, j) => {
      next[j] ^= c;
      next[j + 1] ^= mul(c, EXP[i]);
    });
    g = next;
  }
  return g;
}
function ecBytes(data: number[], n: number): number[] {
  const g = generator(n);
  const r = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const f = r[i];
    if (f !== 0) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], f);
  }
  return r.slice(data.length);
}
const dataCapacity = (v: number) => EC_M[v].blocks.reduce((a, b) => a + b, 0);
export function pickVersion(byteLength: number): number | null {
  for (let v = 1; v <= 10; v++) {
    const bits = 4 + (v < 10 ? 8 : 16) + byteLength * 8;
    if (bits <= dataCapacity(v) * 8) return v;
  }
  return null;
}
function codewords(bytes: Uint8Array, v: number): number[] {
  const cap = dataCapacity(v);
  const bits: number[] = [];
  const put = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < cap; pad = pad === 0xec ? 0x11 : 0xec)
    data.push(pad);
  const { ec, blocks } = EC_M[v];
  const dBlocks: number[][] = [];
  const eBlocks: number[][] = [];
  let o = 0;
  for (const n of blocks) {
    const d = data.slice(o, o + n);
    o += n;
    dBlocks.push(d);
    eBlocks.push(ecBytes(d, ec));
  }
  const out: number[] = [];
  const maxD = Math.max(...blocks);
  for (let i = 0; i < maxD; i++)
    for (const d of dBlocks) if (i < d.length) out.push(d[i]);
  for (let i = 0; i < ec; i++) for (const e of eBlocks) out.push(e[i]);
  return out;
}
const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];
type Grid = { size: number; m: boolean[][]; fixed: boolean[][] };
function base(v: number): Grid {
  const size = 17 + 4 * v;
  const m = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const fixed = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const set = (r: number, c: number, d: boolean) => {
    if (r >= 0 && c >= 0 && r < size && c < size) {
      m[r][c] = d;
      fixed[r][c] = true;
    }
  };
  for (const [r0, c0] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ])
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const inner = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        set(
          r0 + r,
          c0 + c,
          inner &&
            (r === 0 ||
              r === 6 ||
              c === 0 ||
              c === 6 ||
              (r >= 2 && r <= 4 && c >= 2 && c <= 4)),
        );
      }
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const al = ALIGN[v];
  const last = al.length - 1;
  al.forEach((r, i) =>
    al.forEach((c, j) => {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === last) ||
        (i === last && j === 0)
      )
        return;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++)
          set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }),
  );
  set(size - 8, 8, true); // dark module
  for (let i = 0; i < 9; i++) {
    if (!fixed[8][i]) {
      fixed[8][i] = true;
    }
    if (!fixed[i][8]) {
      fixed[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    fixed[8][size - 1 - i] = true;
    fixed[size - 1 - i][8] = true;
  }
  if (v >= 7)
    for (let i = 0; i < 18; i++) {
      fixed[Math.floor(i / 3)][size - 11 + (i % 3)] = true;
      fixed[size - 11 + (i % 3)][Math.floor(i / 3)] = true;
    }
  return { size, m, fixed };
}
function place(g: Grid, words: number[]) {
  const bits: number[] = [];
  words.forEach((w) => {
    for (let i = 7; i >= 0; i--) bits.push((w >>> i) & 1);
  });
  let k = 0,
    up = true;
  for (let c = g.size - 1; c > 0; c -= 2) {
    if (c === 6) c = 5;
    for (let i = 0; i < g.size; i++) {
      const r = up ? g.size - 1 - i : i;
      for (const cc of [c, c - 1])
        if (!g.fixed[r][cc]) {
          g.m[r][cc] = k < bits.length ? bits[k] === 1 : false;
          k++;
        }
    }
    up = !up;
  }
}
function info(g: Grid, v: number, mask: number) {
  const size = g.size;
  const data = mask; // error correction level M has format bits 00
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const f = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => ((f >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) g.m[i][8] = bit(i);
  g.m[7][8] = bit(6);
  g.m[8][8] = bit(7);
  g.m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) g.m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) g.m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) g.m[size - 15 + i][8] = bit(i);
  g.m[size - 8][8] = true;
  if (v >= 7) {
    let r = v;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const vi = (v << 12) | r;
    for (let i = 0; i < 18; i++) {
      const d = ((vi >>> i) & 1) === 1;
      g.m[Math.floor(i / 3)][size - 11 + (i % 3)] = d;
      g.m[size - 11 + (i % 3)][Math.floor(i / 3)] = d;
    }
  }
}
function penalty(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < n; i++) {
      let run = 1;
      for (let j = 1; j < n; j++) {
        const a = pass ? m[j][i] : m[i][j],
          b = pass ? m[j - 1][i] : m[i][j - 1];
        if (a === b) {
          run++;
          if (run === 5) p += 3;
          else if (run > 5) p++;
        } else run = 1;
      }
    }
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < n - 1; j++)
      if (
        m[i][j] === m[i + 1][j] &&
        m[i][j] === m[i][j + 1] &&
        m[i][j] === m[i + 1][j + 1]
      )
        p += 3;
  const pat = [true, false, true, true, true, false, true];
  for (let i = 0; i < n; i++)
    for (let j = 0; j + 10 < n; j++)
      for (const pass of [0, 1]) {
        const get = (k: number) => (pass ? m[j + k][i] : m[i][j + k]);
        const core =
          pat.every((d, k) => get(k) === d) &&
          [7, 8, 9, 10].every((k) => !get(k));
        const core2 =
          [0, 1, 2, 3].every((k) => !get(k)) &&
          pat.every((d, k) => get(k + 4) === d);
        if (core) p += 40;
        if (core2) p += 40;
      }
  const dark = m.flat().filter(Boolean).length;
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}
export function encodeQr(
  text: string,
  forceMask?: number,
): { size: number; modules: boolean[][]; version: number; mask: number } {
  const bytes = new TextEncoder().encode(text);
  const v = pickVersion(bytes.length);
  if (!v) throw new Error("Text too long for a QR code here");
  const words = codewords(bytes, v);
  let best: { m: boolean[][]; mask: number; p: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== undefined && mask !== forceMask) continue;
    const g = base(v);
    place(g, words);
    for (let r = 0; r < g.size; r++)
      for (let c = 0; c < g.size; c++)
        if (!g.fixed[r][c] && MASKS[mask](r, c)) g.m[r][c] = !g.m[r][c];
    info(g, v, mask);
    const p = penalty(g.m);
    if (!best || p < best.p) best = { m: g.m, mask, p };
  }
  return {
    size: best!.m.length,
    modules: best!.m,
    version: v,
    mask: best!.mask,
  };
}
/** An SVG path (one rect per dark module run) with a 4-module quiet zone. */
export function qrSvgPath(modules: boolean[][]): {
  path: string;
  view: number;
} {
  const n = modules.length;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (modules[r][c]) {
        let e = c;
        while (e < n && modules[r][e]) e++;
        parts.push(`M${c + 4} ${r + 4}h${e - c}v1h-${e - c}z`);
        c = e;
      } else c++;
    }
  }
  return { path: parts.join(""), view: n + 8 };
}
