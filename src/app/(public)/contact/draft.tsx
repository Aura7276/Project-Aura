"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function ContactDraft({ address }: { address: string | null }) {
  const [draft, setDraft] = useState("");
  return (
    <>
      <form
        onChange={() => setDraft("")}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const message = form.elements.namedItem(
            "message",
          ) as HTMLTextAreaElement;
          if (message.value.trim().length < 5) {
            message.setCustomValidity(
              "Enter at least five characters of message text.",
            );
            message.reportValidity();
            return;
          }
          const values = new FormData(form);
          setDraft(
            String(values.get("topic")) +
              "\n\n" +
              String(values.get("message")).trim(),
          );
        }}
      >
        <label>
          Topic
          <select name="topic">
            <option>Getting started</option>
            <option>Privacy and sharing</option>
            <option>General enquiry</option>
          </select>
        </label>
        <label>
          Your message
          <textarea
            required
            name="message"
            onInput={(e) => e.currentTarget.setCustomValidity("")}
            minLength={5}
            maxLength={1500}
            rows={5}
          />
        </label>
        <Button type="submit">Prepare enquiry</Button>
      </form>
      {!address && (
        <p>
          The support mailbox has not been configured. You can prepare a local
          draft; delivery is unavailable.
        </p>
      )}
      {draft && (
        <section aria-live="polite">
          <h2>Enquiry draft</h2>
          <p className="whitespace-pre-wrap">{draft}</p>
          {address ? (
            <a
              href={
                "mailto:" +
                address +
                "?subject=" +
                encodeURIComponent("AURA · " + draft.split("\n")[0]) +
                "&body=" +
                encodeURIComponent(draft)
              }
            >
              Open email app to send to {address}
            </a>
          ) : (
            <p>Your draft stays on this page.</p>
          )}
        </section>
      )}
    </>
  );
}
