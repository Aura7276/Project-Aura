"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, Handshake, ArrowRight } from "lucide-react";
import { deliverableDone, type Workspace } from "./model";
import "./collaborations.css";
export function CollaborationList({
  items,
  unavailable,
}: {
  items: Workspace[];
  unavailable: boolean;
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("All");
  const filtered = items.filter(
    ({ collaboration: c }) =>
      (status === "All" || c.status === status) &&
      (c.title + " " + c.brand + " " + c.creator)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="co co-index">
      <Link className="co-wordmark" href="/workspaces">
        aura<span>/ work together</span>
      </Link>
      <header className="co-index-head">
        <div>
          <p>Your partnerships</p>
          <h1>
            Good work.
            <br />
            Made together.
          </h1>
        </div>
        <p>
          Every agreement, handoff and conversation.
          <br />
          One shared place to move things forward.
        </p>
      </header>
      <div className="co-toolbar">
        <label className="co-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a collaboration"
            aria-label="Find a collaboration"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Collaboration status"
        >
          {["All", "Agreement pending", "Active", "Completed", "Cancelled"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </div>
      {unavailable ? (
        <div className="co-empty" role="status">
          <Handshake />
          <h2>Collaborations are temporarily unavailable</h2>
          <p>Return when your workspace connection is restored.</p>
        </div>
      ) : filtered.length ? (
        <div className="co-projects">
          {filtered.map(({ collaboration: c }) => (
            <Link
              href={"/collaborations/" + c.id}
              className="co-project"
              key={c.id}
            >
              <div className="co-project-top">
                <span className="co-monogram">
                  {c.brand.slice(0, 2).toUpperCase()}
                </span>
                <span className="co-chip">{c.status}</span>
                <ArrowUpRight />
              </div>
              <small>{c.category}</small>
              <h2>{c.title}</h2>
              <p>
                {c.brand} &amp; {c.creator}
              </p>
              <footer>
                <span>
                  {c.deliverables.filter(deliverableDone).length} /{" "}
                  {c.deliverables.length} delivered
                </span>
                <ArrowRight />
              </footer>
            </Link>
          ))}
        </div>
      ) : (
        <div className="co-empty">
          <Handshake />
          <h2>
            {query
              ? "No matching collaborations"
              : "Your next partnership starts here"}
          </h2>
          <p>
            {query
              ? "Try a project or partner name."
              : "Confirmed proposals will open a shared workspace for both parties."}
          </p>
        </div>
      )}
    </div>
  );
}
