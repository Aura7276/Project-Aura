import Link from "next/link";
import {
  Bell,
  CircleHelp,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react";
import { logout } from "@/features/auth/actions";
import { assistantAvailability } from "./assistant";
import { AssistantDialog, QuickCreate } from "./dialogs";
import type { FormState } from "./actions";
import type { GoalOption } from "./forms";
import { BottomNav, Drawer, OpenDialog, SideNav } from "./nav-client";
import { Walkthrough } from "./walkthrough";
import "./studio.css";

type Act = (prev: FormState, form: FormData) => Promise<FormState>;
export type ShellProps = {
  pathname?: string;
  workspaceName: string;
  displayName: string;
  goals: GoalOption[];
  today: string;
  walkthroughStatus: string;
  live: boolean;
  children: React.ReactNode;
  captureIdea?: Act;
  recordObservation?: Act;
  saveWalkthrough?: (s: string) => Promise<unknown>;
};
const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "C";
function AccountMenu({ name, live }: { name: string; live: boolean }) {
  return (
    <details className="st-account">
      <summary>
        <span className="st-avatar" aria-hidden>
          {initials(name)}
        </span>
        <span>{name}</span>
      </summary>
      <ul className="st-list" style={{ marginTop: "0.5rem" }}>
        <li>
          <Link href="/creator/settings/dashboard">
            <Settings aria-hidden size={14} /> Dashboard settings
          </Link>
        </li>
        <li>
          <Link href="/security">
            <Shield aria-hidden size={14} /> Account security
          </Link>
        </li>
        <li>
          <Link href="/workspaces">
            <ArrowLeftRight aria-hidden size={14} /> Switch workspace
          </Link>
        </li>
        <li>
          {live ? (
            <form action={logout}>
              <button className="st-btn" style={{ width: "100%" }}>
                <LogOut aria-hidden size={14} />
                &nbsp;Log out
              </button>
            </form>
          ) : (
            <span className="st-hint">Log out (not in preview)</span>
          )}
        </li>
      </ul>
    </details>
  );
}
export function StudioShell(p: ShellProps) {
  const ai = assistantAvailability();
  return (
    <div className="st">
      <a className="st-skip" href="#main">
        Skip to content
      </a>
      <aside className="st-side" aria-label="Creator Studio sidebar">
        <SideNav workspaceName={p.workspaceName} pathname={p.pathname} />
        <div style={{ marginTop: "auto" }}>
          <AccountMenu name={p.displayName} live={p.live} />
        </div>
      </aside>
      <div className="st-shellbody">
        <header className="st-top">
          <OpenDialog
            target="studio-drawer"
            className="st-iconbtn st-menu"
            label="Open menu"
          >
            <Menu aria-hidden size={20} />
          </OpenDialog>
          <form
            className="st-search"
            role="search"
            action="/creator/search"
            method="get"
          >
            <label
              htmlFor="global-search"
              className="ob-sr"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              Search Creator Studio
            </label>
            <input
              id="global-search"
              name="q"
              type="search"
              placeholder="Search"
              minLength={2}
              maxLength={60}
              autoComplete="off"
            />
          </form>
          <OpenDialog
            target="quick-create-dialog"
            className="st-iconbtn primary"
            label="Quick create"
          >
            <span
              data-tour="quick-create"
              style={{
                display: "inline-flex",
                gap: "0.4rem",
                alignItems: "center",
              }}
            >
              <Plus aria-hidden size={18} />
              <span className="lbl">Create</span>
            </span>
          </OpenDialog>
          <OpenDialog
            target="assistant-dialog"
            className="st-iconbtn"
            label="Open Growth Assistant"
          >
            <span
              data-tour="assistant"
              style={{
                display: "inline-flex",
                gap: "0.4rem",
                alignItems: "center",
              }}
            >
              <Sparkles aria-hidden size={18} />
              <span className="lbl">Assistant</span>
            </span>
          </OpenDialog>
          <Link
            href="/creator/notifications"
            className="st-iconbtn"
            aria-label="Notifications"
          >
            <Bell aria-hidden size={18} />
          </Link>
        </header>
        <main id="main" tabIndex={-1} className="st-main">
          <Walkthrough
            status={p.walkthroughStatus}
            live={p.live}
            save={p.saveWalkthrough}
          />
          {p.children}
        </main>
      </div>
      <BottomNav pathname={p.pathname} />
      <Drawer workspaceName={p.workspaceName} pathname={p.pathname}>
        <AccountMenu name={p.displayName} live={p.live} />
        <ul className="st-list" aria-label="Quick tools">
          <li>
            <Link className="st-btn" href="/creator/search">
              <Search aria-hidden size={14} />
              &nbsp;Search
            </Link>
          </li>
          <li>
            <Link className="st-btn" href="/creator/notifications">
              <Bell aria-hidden size={14} />
              &nbsp;Notifications
            </Link>
          </li>
          <li>
            <OpenDialog
              target="quick-create-dialog"
              closeFirst="studio-drawer"
              className="st-btn"
            >
              <Plus aria-hidden size={14} />
              &nbsp;Quick create
            </OpenDialog>
          </li>
          <li>
            <OpenDialog
              target="assistant-dialog"
              closeFirst="studio-drawer"
              className="st-btn"
            >
              <Sparkles aria-hidden size={14} />
              &nbsp;Growth Assistant
            </OpenDialog>
          </li>
          <li>
            <Link className="st-btn" href="/creator/dashboard?tour=1">
              <CircleHelp aria-hidden size={14} />
              &nbsp;Take the tour
            </Link>
          </li>
        </ul>
      </Drawer>
      <QuickCreate
        goals={p.goals}
        today={p.today}
        live={p.live}
        captureIdea={p.captureIdea}
        recordObservation={p.recordObservation}
      />
      <AssistantDialog
        workspaceName={p.workspaceName}
        available={ai.available}
        reason={ai.available ? "" : ai.reason}
        pathname={p.pathname}
      />
    </div>
  );
}
