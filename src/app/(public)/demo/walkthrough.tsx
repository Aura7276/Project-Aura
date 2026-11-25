"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
const journeys = {
  Creator: [
    [
      "Profile and goals",
      "Set an objective",
      "Choose a creative skill you want to practise. A private growth goal stays separate from your published professional identity.",
    ],
    [
      "Growth assistant",
      "Turn a goal into practice",
      "Example coaching note: Try a short tutorial twice this week. Change the opening and record what you learn.",
    ],
    [
      "Social analytics",
      "Review comparable evidence",
      "Compare observations for the same format and time window. Mark unavailable metrics as missing.",
    ],
    [
      "Content planning",
      "Prepare a shoot",
      "Move from a pillar to a hook, script, shot list and publish date. Keep a note of the experiment.",
    ],
    [
      "Profile and media kit",
      "Choose what to share",
      "Select work samples and explain your contribution. Review each public field before publishing.",
    ],
    [
      "Campaign discovery",
      "Check the brief",
      "Review the format, rights, language and eligibility. UGC assesses creative capability separately from follower count.",
    ],
    [
      "Collaboration management",
      "Confirm the scope",
      "Review proposed deliverables, revisions and approvals before agreeing to a collaboration.",
    ],
    [
      "Earnings overview",
      "Reconcile external payments",
      "Keep agreed compensation, invoices and recorded external payments separate. AURA holds no funds.",
    ],
  ],
  Brand: [
    [
      "Business onboarding",
      "Establish the objective",
      "Describe a business, its customers and marketing goals. Private planning can start without a social account.",
    ],
    [
      "Marketing strategy",
      "Choose a channel",
      "Plan one product demonstration around a customer question. Identify what evidence can guide the next brief.",
    ],
    [
      "Creator discovery",
      "Review creative fit",
      "Use authorized portfolio, language and capability information. Verification gates formal outreach.",
    ],
    [
      "Campaign planning",
      "Specify requirements",
      "Define deliverables, rights, deadlines and commercial terms for the selected format.",
    ],
    [
      "Content production",
      "Prepare for approval",
      "Draft a script, assemble the shot list and identify who approves the final asset.",
    ],
    [
      "Collaboration management",
      "Track review decisions",
      "Record revisions against the agreed brief and separate acceptance from settlement.",
    ],
    [
      "Performance reporting",
      "Review what is known",
      "Distinguish fulfilled work, marketing observations and externally settled amounts. Note gaps in coverage.",
    ],
  ],
} as const;
export function Walkthrough() {
  const [role, setRole] = useState<keyof typeof journeys>("Creator");
  const [step, setStep] = useState(0);
  const items = journeys[role];
  const [name, title, description] = items[step];
  return (
    <div className="tour">
      <fieldset>
        <legend>Choose a journey</legend>
        {(["Creator", "Brand"] as const).map((r) => (
          <label key={r}>
            <input
              type="radio"
              name="journey"
              checked={role === r}
              onChange={() => {
                setRole(r);
                setStep(0);
              }}
            />{" "}
            {r}
          </label>
        ))}
      </fieldset>
      <label>
        Jump to a step{" "}
        <select value={step} onChange={(e) => setStep(Number(e.target.value))}>
          {items.map(([n], i) => (
            <option key={n} value={i}>
              {i + 1}. {n}
            </option>
          ))}
        </select>
      </label>
      <section aria-live="polite" aria-atomic="true">
        <small>
          {role} · {step + 1} of {items.length} · {name}
        </small>
        <h2>{title}</h2>
        <p>{description}</p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!step} onClick={() => setStep(step - 1)}>
          Previous
        </Button>
        {step < items.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>Next step</Button>
        ) : (
          <Button onClick={() => setStep(0)}>Restart journey</Button>
        )}
      </div>
    </div>
  );
}
