"use client";
import { ErrorState } from "@/components/ui/feedback";
// Never shows error details: they could contain private Creator data.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <ErrorState>We could not load this page. Your data is safe.</ErrorState>
      <p>
        <button type="button" className="st-btn primary" onClick={reset}>
          Try again
        </button>
      </p>
    </>
  );
}
