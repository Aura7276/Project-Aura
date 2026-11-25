"use client";
import { useId, useMemo, useState } from "react";

export type Option = { value: string; label: string; hint?: string };
export function OptionGroup({
  legend,
  hint,
  options,
  selected,
  onChange,
  multiple = false,
  max,
  searchable = false,
  cols = 1,
  error,
  name,
}: {
  legend: string;
  hint?: string;
  options: readonly Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  max?: number;
  searchable?: boolean;
  cols?: 1 | 2;
  error?: string;
  name: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () =>
      options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [options, query],
  );
  const full = multiple && max !== undefined && selected.length >= max;
  return (
    <fieldset
      aria-describedby={`${id}-d`}
      aria-invalid={error ? true : undefined}
    >
      <legend>{legend}</legend>
      <p className="ob-hint" id={`${id}-d`}>
        {hint}
        {max ? ` Choose up to ${max}.` : ""}
        {multiple && max ? ` ${selected.length} chosen.` : ""}
      </p>
      {searchable && (
        <div className="ob-field">
          <label htmlFor={`${id}-q`} className="ob-sr">
            Search {legend.toLowerCase()}
          </label>
          <input
            id={`${id}-q`}
            type="search"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
      )}
      <div
        className="ob-cards"
        data-cols={cols}
        role="group"
        aria-label={legend}
      >
        {shown.map((o) => {
          const on = selected.includes(o.value);
          return (
            <label key={o.value} className="ob-card" data-multi={multiple}>
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`${name}-${id}`}
                value={o.value}
                checked={on}
                disabled={!on && full}
                onChange={() =>
                  onChange(
                    multiple
                      ? on
                        ? selected.filter((s) => s !== o.value)
                        : [...selected, o.value]
                      : [o.value],
                  )
                }
              />
              <span className="mark" aria-hidden />
              <span>
                <strong>{o.label}</strong>
                {o.hint && <small>{o.hint}</small>}
              </span>
            </label>
          );
        })}
        {!shown.length && (
          <p className="ob-hint">
            No matches. Try a different word
            {multiple ? ", or add your own below" : ""}.
          </p>
        )}
      </div>
      <p aria-live="polite" className="ob-sr">
        {shown.length} options shown
      </p>
      {error && (
        <p className="ob-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
};
function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  const described =
    [hint ? `${id}-h` : "", error ? `${id}-e` : ""].filter(Boolean).join(" ") ||
    undefined;
  return { id, described };
}
export function TextField({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  type = "text",
  maxLength,
  inputMode,
  placeholder,
  autoComplete,
}: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "text" | "url";
  placeholder?: string;
  autoComplete?: string;
}) {
  const { id, described } = useFieldIds(error, hint);
  return (
    <div className="ob-field">
      <label htmlFor={id}>
        {label}
        {optional ? " (optional)" : ""}
      </label>
      {hint && (
        <p className="ob-hint" id={`${id}-h`}>
          {hint}
        </p>
      )}
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p className="ob-error" id={`${id}-e`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function AreaField({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  maxLength,
}: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
}) {
  const { id, described } = useFieldIds(error, hint);
  return (
    <div className="ob-field">
      <label htmlFor={id}>
        {label}
        {optional ? " (optional)" : ""}
      </label>
      {hint && (
        <p className="ob-hint" id={`${id}-h`}>
          {hint}
        </p>
      )}
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="ob-hint" aria-hidden>
        {value.length}/{maxLength}
      </p>
      {error && (
        <p className="ob-error" id={`${id}-e`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function SelectField({
  label,
  hint,
  error,
  optional,
  value,
  onChange,
  options,
  placeholder = "Choose",
}: FieldProps & {
  value: string;
  onChange: (v: string) => void;
  options: readonly Option[];
  placeholder?: string;
}) {
  const { id, described } = useFieldIds(error, hint);
  return (
    <div className="ob-field">
      <label htmlFor={id}>
        {label}
        {optional ? " (optional)" : ""}
      </label>
      {hint && (
        <p className="ob-hint" id={`${id}-h`}>
          {hint}
        </p>
      )}
      <select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="ob-error" id={`${id}-e`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function CheckCard({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="ob-card" data-multi="true">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="mark" aria-hidden />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}
