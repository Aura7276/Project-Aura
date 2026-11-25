"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  groups,
  destinations,
  destinationPath,
  implementedDestination,
  type Destination,
} from "@/config/navigation";
import { Wordmark, DestinationItem } from "./destination";
export function PublicHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const wide = matchMedia("(min-width: 75rem)");
    const close = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);
  function items(mobile: boolean) {
    const item = (id: Destination) => (
      <DestinationItem key={id} id={id} current={path} />
    );
    return (
      <>
        {(["creators", "brands", "agencies"] as const).map(item)}
        {Object.entries(groups).map(([name, ids]) =>
          mobile ? (
            <details key={name}>
              <summary>{name}</summary>
              {ids.map(item)}
            </details>
          ) : (
            <DropdownMenu key={name} modal={false}>
              <DropdownMenuTrigger className="group-trigger">
                {name}
                <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                onFocus={(event) => {
                  if (event.target === event.currentTarget)
                    event.currentTarget
                      .querySelector<HTMLElement>(
                        '[role="menuitem"]:not([data-disabled])',
                      )
                      ?.focus();
                }}
              >
                {ids.map((id) => (
                  <DropdownMenuItem
                    key={id}
                    disabled={
                      !implementedDestination(id) &&
                      process.env.NODE_ENV !== "development"
                    }
                    asChild={
                      implementedDestination(id) ||
                      process.env.NODE_ENV === "development"
                    }
                  >
                    {implementedDestination(id) ||
                    process.env.NODE_ENV === "development" ? (
                      <a
                        href={destinationPath(id)}
                        aria-current={
                          path === destinationPath(id) ? "page" : undefined
                        }
                      >
                        {destinations[id][0]}
                      </a>
                    ) : (
                      destinations[id][0] + " · Pending"
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        )}
        {item("pricing")}
        <div className="entry">
          {item("login")}
          {item("register")}
        </div>
      </>
    );
  }
  return (
    <header className="public-head">
      <div className="shell head-row">
        <Wordmark home={path === "/"} />
        <nav className="wide-nav" aria-label="Primary">
          {items(false)}
        </nav>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            className="compact-menu"
            aria-label="Open navigation menu"
          >
            <Menu size={21} />
            Menu
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogTitle>Navigation</DialogTitle>
            <DialogDescription className="sr-only">
              Public website destinations
            </DialogDescription>
            <nav aria-label="Mobile primary" className="mobile-links">
              {items(true)}
            </nav>
          </DialogContent>
        </Dialog>
      </div>
    </header>
  );
}
