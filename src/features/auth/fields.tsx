"use client";
import { useState } from "react";
export function Field({
  name,
  label,
  type = "text",
  optional = false,
  initial = "",
}: {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  initial?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label>
        {label}
        <input
          name={name}
          type={visible ? "text" : type}
          defaultValue={initial}
          required={!optional}
          autoComplete={
            (
              {
                email: "email",
                current: "current-password",
                confirm: "new-password",
                mobile: "tel",
                name: "name",
                country: "country",
                code: "one-time-code",
              } as Record<string, string>
            )[name]
          }
        />
      </label>
      {type === "password" && (
        <button
          type="button"
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Hide" : "Show"} {label.toLowerCase()}
        </button>
      )}
    </>
  );
}
export function IdentityFields({
  name = "",
  country = "",
  mobile = "",
}: {
  name?: string;
  country?: string;
  mobile?: string;
}) {
  return (
    <>
      <Field name="name" label="Your name" initial={name} />
      <Field
        name="country"
        label="Two-letter country code (e.g. IN)"
        initial={country}
      />
      <Field
        name="mobile"
        label="Mobile including country code (optional)"
        initial={mobile}
        type="tel"
        optional
      />
      <label>
        <input name="adult" type="checkbox" required />I confirm I am at least
        18 years old.
      </label>
    </>
  );
}
export function PasswordFields() {
  return (
    <>
      <Field
        name="password"
        type="password"
        label="New password (12–128 characters)"
      />
      <Field name="confirm" type="password" label="Confirm new password" />
    </>
  );
}
