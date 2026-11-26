"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Handshake,
  House,
  Lock,
  PenLine,
  Sprout,
  CircleUser,
  X,
} from "lucide-react";
import { areaFor, areas, type NavArea } from "./nav";

const icons = {
  house: House,
  sprout: Sprout,
  pen: PenLine,
  handshake: Handshake,
  user: CircleUser,
} as const;
export function openDialog(id: string) {
  const el = document.getElementById(id);
  if (el instanceof HTMLDialogElement && !el.open) el.showModal();
}
export function OpenDialog({
  target,
  className,
  children,
  label,
  closeFirst,
}: {
  target: string;
  className?: string;
  children: React.ReactNode;
  label?: string;
  closeFirst?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-haspopup="dialog"
      aria-label={label}
      onClick={() => {
        if (closeFirst)
          (
            document.getElementById(closeFirst) as HTMLDialogElement | null
          )?.close();
        openDialog(target);
      }}
    >
      {children}
    </button>
  );
}
function AreaList({
  list,
  pathname,
  onNavigate,
}: {
  list: NavArea[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const current = areaFor(pathname);
  return (
    <ul>
      {list.map((a) => {
        const Icon = icons[a.icon];
        return (
          <li key={a.id}>
            <Link
              href={a.href}
              aria-current={
                current === a.id
                  ? pathname === a.href
                    ? "page"
                    : "true"
                  : undefined
              }
              data-tour={`area-${a.id}`}
              onClick={onNavigate}
            >
              <Icon aria-hidden size={18} />
              {a.label}
            </Link>
            <ul
              aria-label={`${a.label} destinations`}
              style={{ paddingLeft: "1.6rem" }}
            >
              {a.items
                .filter((i) => i.href !== a.href)
                .map((i) => (
                  <li key={i.id}>
                    {i.href ? (
                      <Link
                        href={i.href}
                        aria-current={pathname === i.href ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        {i.label}
                      </Link>
                    ) : (
                      <span
                        className="st-planned"
                        data-dependency={i.module}
                        aria-disabled="true"
                      >
                        <span>
                          <Lock aria-hidden size={14} /> {i.label}
                        </span>
                        <span className="st-badge">Planned</span>
                        <span
                          className="ob-sr"
                          style={{
                            position: "absolute",
                            width: 1,
                            height: 1,
                            overflow: "hidden",
                          }}
                        >
                          {i.note}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
export function SideNav({
  workspaceName,
  pathname: forced,
}: {
  workspaceName: string;
  pathname?: string;
}) {
  const real = usePathname();
  const pathname = forced ?? real;
  return (
    <>
      <div>
        <Link className="st-mark" href="/creator/dashboard">
          AURA
        </Link>
        <p className="st-hint" style={{ margin: "0.2rem 0 0" }}>
          Creator Studio · {workspaceName}
        </p>
      </div>
      <nav aria-label="Creator Studio">
        <AreaList list={areas} pathname={pathname} />
      </nav>
    </>
  );
}
export function BottomNav({ pathname: forced }: { pathname?: string }) {
  const real = usePathname();
  const pathname = forced ?? real;
  const current = areaFor(pathname);
  return (
    <nav className="st-bottom" aria-label="Primary">
      {areas.map((a) => {
        const Icon = icons[a.icon];
        return (
          <Link
            key={a.id}
            href={a.href}
            aria-current={current === a.id ? "page" : undefined}
            data-tour={`bottom-${a.id}`}
          >
            <Icon aria-hidden />
            <span>{a.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
export function Drawer({
  workspaceName,
  children,
  pathname: forced,
}: {
  pathname?: string;
  workspaceName: string;
  children: React.ReactNode;
}) {
  const real = usePathname();
  const pathname = forced ?? real;
  const close = () =>
    (
      document.getElementById("studio-drawer") as HTMLDialogElement | null
    )?.close();
  return (
    <dialog
      id="studio-drawer"
      className="st-dialog st-drawer"
      aria-labelledby="drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="in">
        <header>
          <h2 id="drawer-title">Menu</h2>
          <button
            type="button"
            className="st-iconbtn"
            onClick={close}
            aria-label="Close menu"
          >
            <X aria-hidden size={18} />
          </button>
        </header>
        <p className="st-hint">{workspaceName}</p>
        <nav aria-label="Creator Studio menu">
          <AreaList list={areas} pathname={pathname} onNavigate={close} />
        </nav>
        {children}
      </div>
    </dialog>
  );
}
