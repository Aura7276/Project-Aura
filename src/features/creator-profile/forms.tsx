"use client";
import { useState } from "react";
import { useIdempotentForm } from "@/lib/use-idempotent-form";
import type { FormState } from "./actions";
import { encodeQr, qrSvgPath } from "./qr";

type Act = (prev: FormState, form: FormData) => Promise<FormState>;
export type FieldDef = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "number"
    | "date"
    | "url"
    | "lines"
    | "hidden";
  options?: Record<string, string>;
  hint?: string;
  max?: number;
  min?: number;
  required?: boolean;
  value?: string | number | boolean | null;
  rows?: number;
  showIf?: { field: string; in: string[] };
};
/** One accessible form renderer for every M09 editor. Validation errors keep what was typed (see useIdempotentForm). */
export function EntityForm({
  action,
  fields,
  submit,
  label,
  idPrefix,
  children,
}: {
  action: Act;
  fields: FieldDef[];
  submit: string;
  label: string;
  idPrefix: string;
  children?: React.ReactNode;
}) {
  const { state, onSubmit, pending, ref } = useIdempotentForm(action);
  const s = state as FormState;
  const e = s?.errors ?? {};
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields
        .filter((f) => f.type === "select")
        .map((f) => [
          f.name,
          String(f.value ?? Object.keys(f.options ?? {})[0] ?? ""),
        ]),
    ),
  );
  return (
    <form onSubmit={onSubmit} ref={ref} noValidate aria-label={label}>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.name}`;
        const err = e[f.name];
        if (f.showIf && !f.showIf.in.includes(vals[f.showIf.field] ?? ""))
          return null;
        if (f.type === "hidden")
          return (
            <input
              key={f.name}
              type="hidden"
              name={f.name}
              value={String(f.value ?? "")}
            />
          );
        const common = {
          id,
          name: f.name,
          "aria-invalid": err ? true : undefined,
          "aria-describedby":
            [f.hint ? `${id}-h` : "", err ? `${id}-e` : ""]
              .filter(Boolean)
              .join(" ") || undefined,
        } as const;
        if (f.type === "checkbox")
          return (
            <p key={f.name}>
              <label>
                <input
                  type="checkbox"
                  name={f.name}
                  defaultChecked={!!f.value}
                />{" "}
                {f.label}
              </label>
              {f.hint && (
                <span className="st-hint" id={`${id}-h`}>
                  {" "}
                  {f.hint}
                </span>
              )}
            </p>
          );
        return (
          <div className="st-field" key={f.name}>
            <label htmlFor={id}>
              {f.label}
              {f.required ? "" : " (optional)"}
            </label>
            {f.type === "textarea" || f.type === "lines" ? (
              <textarea
                {...common}
                defaultValue={String(f.value ?? "")}
                maxLength={f.max}
                rows={f.rows ?? (f.type === "lines" ? 4 : 5)}
              />
            ) : f.type === "select" ? (
              <select
                {...common}
                defaultValue={String(f.value ?? "")}
                onChange={(ev) =>
                  setVals((v) => ({ ...v, [f.name]: ev.target.value }))
                }
              >
                {Object.entries(f.options ?? {}).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={f.type === "url" ? "url" : (f.type ?? "text")}
                defaultValue={
                  f.value === null || f.value === undefined
                    ? ""
                    : String(f.value)
                }
                maxLength={f.max}
                min={f.min}
                inputMode={f.type === "number" ? "decimal" : undefined}
              />
            )}
            {f.hint && (
              <p className="st-hint" id={`${id}-h`}>
                {f.hint}
              </p>
            )}
            {err && (
              <p className="st-error" id={`${id}-e`}>
                {err}
              </p>
            )}
          </div>
        );
      })}
      {children}
      <button className="st-btn primary" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : submit}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={s?.ok ? "st-ok" : "st-error"}
      >
        {s?.message}
      </p>
      {s?.link && <SecretLink link={s.link} />}
    </form>
  );
}
export function Qr({ text, label }: { text: string; label: string }) {
  const q = encodeQr(text);
  const { path, view } = qrSvgPath(q.modules);
  return (
    <svg
      className="pf-qr"
      viewBox={`0 0 ${view} ${view}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={view} height={view} fill="#fff" />
      <path d={path} fill="#17152d" />
    </svg>
  );
}
/** A link that is shown once (its token is never stored), with copy, QR and a download of the QR as SVG. */
export function SecretLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const q = encodeQr(link);
  const { path, view } = qrSvgPath(q.modules);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view} ${view}" width="512" height="512" shape-rendering="crispEdges"><rect width="${view}" height="${view}" fill="#fff"/><path d="${path}" fill="#17152d"/></svg>`;
  return (
    <div className="pf-secret" role="group" aria-label="Your new link">
      <code>{link}</code>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="st-btn"
          onClick={() =>
            navigator.clipboard?.writeText(link).then(() => setCopied(true))
          }
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          className="st-btn"
          href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
          download="aura-qr.svg"
        >
          Download QR code
        </a>
      </div>
      <Qr text={link} label="QR code for this link" />
      <p className="st-hint">
        The QR code opens exactly this link, so revoking the link also stops the
        QR code.
      </p>
    </div>
  );
}
/** Section ordering with buttons (no drag and drop, so it works with a keyboard and a screen reader). */
export function OrderField({
  name,
  initial,
  labels,
}: {
  name: string;
  initial: string[];
  labels: Record<string, string>;
}) {
  const [order, setOrder] = useState(initial);
  const move = (i: number, d: number) =>
    setOrder((o) => {
      const n = [...o];
      const j = i + d;
      if (j < 0 || j >= n.length) return o;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <fieldset>
      <legend>Section order</legend>
      <input type="hidden" name={name} value={order.join(",")} />
      <ol className="st-list">
        {order.map((k, i) => (
          <li
            key={k}
            className="st-item"
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span style={{ flex: 1 }}>{labels[k]}</span>
            <button
              type="button"
              className="st-btn"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={`Move ${labels[k]} up`}
            >
              Up
            </button>
            <button
              type="button"
              className="st-btn"
              onClick={() => move(i, 1)}
              disabled={i === order.length - 1}
              aria-label={`Move ${labels[k]} down`}
            >
              Down
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
