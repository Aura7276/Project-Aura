"use client";
import { useIdempotentForm } from "@/lib/use-idempotent-form";
import { duplicateForm } from "./actions";

/** One request id per click (reused on retry), so a double click makes one copy. */
export function DuplicateButton({ id, w }: { id: string; w: string }) {
  const { onSubmit, pending, state } = useIdempotentForm(duplicateForm);
  return (
    <form
      onSubmit={onSubmit}
      aria-label={`Duplicate campaign ${id.slice(0, 8)}`}
    >
      <input type="hidden" name="w" value={w} />
      <input type="hidden" name="id" value={id} />
      <button className="st-btn" disabled={pending}>
        {pending ? "Copying…" : "Duplicate"}
      </button>
      {state?.message && (
        <span role="status" className="st-error">
          {" "}
          {state.message}
        </span>
      )}
    </form>
  );
}
