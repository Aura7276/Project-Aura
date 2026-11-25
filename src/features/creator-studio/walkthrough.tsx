"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

export type TourStep = {
  title: string;
  body: string;
  targets: string[];
  planned?: string;
};
export const tourSteps: TourStep[] = [
  {
    title: "Home",
    body: "Your priorities for today, goals and plan live here.",
    targets: ["area-home", "bottom-home"],
  },
  {
    title: "Grow",
    body: "Daily actions, progress and your self-reported accounts.",
    targets: ["area-grow", "bottom-grow"],
  },
  {
    title: "Create",
    body: "Capture ideas now. Scripts and the calendar arrive with Content Studio (planned).",
    targets: ["area-create", "bottom-create"],
  },
  {
    title: "Collaborate",
    body: "See what standard and UGC collaborations need. Published campaigns arrive later (planned).",
    targets: ["area-collaborate", "bottom-collaborate"],
  },
  {
    title: "My Studio",
    body: "Your profile, settings, security and workspace.",
    targets: ["area-studio", "bottom-studio"],
  },
  {
    title: "Daily actions",
    body: "Three to five practical things for today. Tick them off, skip or defer.",
    targets: ["actions", "area-grow", "bottom-grow"],
  },
  {
    title: "Goal tracking",
    body: "Record your own numbers over time. Nothing is guessed for you.",
    targets: ["goals", "area-grow", "bottom-grow"],
  },
  {
    title: "Quick create",
    body: "Capture an idea or record progress from anywhere.",
    targets: ["quick-create"],
  },
  {
    title: "Assistant",
    body: "The Growth Assistant entry point. It shows honestly when it is not available yet.",
    targets: ["assistant"],
  },
];
const visible = (el: Element | null): el is HTMLElement =>
  !!el && el instanceof HTMLElement && el.getClientRects().length > 0;
function findTarget(names: string[]) {
  for (const n of names)
    for (const el of Array.from(
      document.querySelectorAll(`[data-tour="${n}"]`),
    ))
      if (visible(el)) return el;
  return null;
}
function Tour({
  status,
  live,
  save,
}: {
  status: string;
  live: boolean;
  save?: (s: string) => Promise<unknown>;
}) {
  const params = useSearchParams();
  const fromLink = params.get("tour") === "1";
  const [open, setOpen] = useState(fromLink);
  const [dismissed, setDismissed] = useState(status !== "not_seen" || fromLink);
  const [i, setI] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const clear = () =>
    document
      .querySelectorAll("[data-tour-active]")
      .forEach((e) => e.removeAttribute("data-tour-active"));
  useEffect(() => {
    clear();
    if (!open) return;
    const t = findTarget(tourSteps[i].targets);
    if (t) {
      t.setAttribute("data-tour-active", "true");
      t.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
    next.current?.focus({ preventScroll: true });
    return clear;
  }, [open, i]);
  const finish = useCallback(
    async (s: "completed" | "dismissed") => {
      clear();
      setOpen(false);
      setDismissed(true);
      if (live && save) await save(s);
    },
    [live, save],
  );
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") void finish("dismissed");
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, finish]);
  const step = tourSteps[i];
  return (
    <>
      {!dismissed && !open && (
        <div
          className="st-notice"
          role="region"
          aria-label="Product walkthrough offer"
          style={{
            justifyContent: "space-between",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <span>
            New here? Take a one-minute tour of Creator Studio. It is optional.
          </span>
          <span style={{ display: "flex", gap: "0.4rem" }}>
            <button
              type="button"
              className="st-btn primary"
              onClick={() => {
                setOpen(true);
                setI(0);
              }}
            >
              Start tour
            </button>
            <button
              type="button"
              className="st-btn"
              onClick={() => void finish("dismissed")}
            >
              Not now
            </button>
          </span>
        </div>
      )}
      {open && (
        <section
          className="st-tour"
          role="region"
          aria-label="Product walkthrough"
          aria-live="polite"
        >
          <p style={{ margin: 0, fontSize: "0.8rem" }}>
            Step {i + 1} of {tourSteps.length}
          </p>
          <h2 style={{ color: "white", marginBottom: "0.25rem" }}>
            {step.title}
          </h2>
          <p>{step.body}</p>
          {!live && (
            <p style={{ fontSize: "0.8rem" }}>
              Preview: your progress through the tour is not saved.
            </p>
          )}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="st-btn"
              onClick={() => setI(Math.max(0, i - 1))}
              disabled={i === 0}
            >
              Back
            </button>
            {i < tourSteps.length - 1 ? (
              <button
                type="button"
                className="st-btn primary"
                ref={next}
                onClick={() => setI(i + 1)}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="st-btn primary"
                ref={next}
                onClick={() => void finish("completed")}
              >
                Done
              </button>
            )}
            <button
              type="button"
              className="st-btn"
              onClick={() => void finish("dismissed")}
            >
              Skip tour
            </button>
          </div>
        </section>
      )}
    </>
  );
}
export function Walkthrough(props: {
  status: string;
  live: boolean;
  save?: (s: string) => Promise<unknown>;
}) {
  return (
    <Suspense fallback={null}>
      <Tour {...props} />
    </Suspense>
  );
}
