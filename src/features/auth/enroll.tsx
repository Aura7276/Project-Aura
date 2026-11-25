"use client";
import { useState } from "react";
import { enroll, challenge } from "./actions";
import { Field } from "./fields";
export function Enroll() {
  const [factor, setFactor] = useState<Awaited<ReturnType<typeof enroll>>>();
  return factor ? (
    <form action={challenge}>
      <p>Enter this setup key in your authenticator app.</p>
      <code>{factor.secret}</code>
      <input type="hidden" name="factor" value={factor.id} />
      <Field name="code" label="Six-digit authenticator code" />
      <button>Verify authenticator</button>
    </form>
  ) : (
    <form action={async () => setFactor(await enroll())}>
      <button>Set up authenticator</button>
    </form>
  );
}
