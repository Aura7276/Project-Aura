"use client";
import { useId, useState } from "react";
export function StudioPreview({
  notes,
}: {
  notes: readonly (readonly [string, string, string, string, string])[];
}) {
  const [active, setActive] = useState(0);
  const id = useId();
  const [, title, caption, first, last] = notes[active];
  return (
    <div>
      <div
        role="tablist"
        aria-label="Studio preview"
        className="inline-flex rounded-lg bg-white p-1"
      >
        {notes.map(([label], index) => (
          <button
            type="button"
            key={label}
            id={id + "-tab-" + index}
            role="tab"
            aria-selected={active === index}
            aria-controls={id + "-panel-" + index}
            tabIndex={active === index ? 0 : -1}
            className="min-h-11 rounded-md px-3 aria-selected:bg-midnight aria-selected:text-white"
            onClick={() => setActive(index)}
            onKeyDown={(e) => {
              const next = (
                {
                  ArrowRight: (index + 1) % notes.length,
                  ArrowLeft: (index + notes.length - 1) % notes.length,
                  Home: 0,
                  End: notes.length - 1,
                } as Record<string, number>
              )[e.key];
              if (next === undefined) return;
              e.preventDefault();
              setActive(next);
              document.getElementById(id + "-tab-" + next)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {notes.map(([key], index) => (
        <div
          key={key}
          role="tabpanel"
          tabIndex={0}
          id={id + "-panel-" + index}
          aria-labelledby={id + "-tab-" + index}
          hidden={index !== active}
        >
          {index === active && (
            <>
              <small>{caption}</small>
              <h3>{title}</h3>
              <p>{first}</p>
              <p>{last}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
