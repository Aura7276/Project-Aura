"use client";
import { startTransition, useActionState, useRef } from "react";
export type FormResult = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
} | null;
/**
 * One idempotency key per logical submission: created on first submit, reused on a retry (so a double click or a retry after a network error
 * cannot create a duplicate), and discarded after success.
 * React 19 resets an uncontrolled form after every `action=` submission, even a failed one, which would wipe what the person typed when
 * validation fails. So the submit is intercepted, the action runs inside a transition, and the form is reset only after a successful result.
 */
export function useIdempotentForm(
  action: (prev: FormResult, form: FormData) => Promise<FormResult>,
  initial: FormResult = null,
) {
  const key = useRef<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  const wrapped = async (
    prev: FormResult,
    form: FormData,
  ): Promise<FormResult> => {
    key.current ??= crypto.randomUUID();
    form.set("request", key.current);
    const result = await action(prev, form);
    if (result?.ok) {
      key.current = null;
      ref.current?.reset();
    }
    return result;
  };
  const [state, run, pending] = useActionState<FormResult, FormData>(
    wrapped,
    initial,
  );
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };
  return { state, pending, ref, onSubmit };
}
