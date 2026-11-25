import Link from "next/link";
import {
  destinations,
  implementedDestination,
  destinationPath,
  type Destination,
} from "@/config/navigation";
export function DestinationItem({
  id,
  current,
}: {
  id: Destination;
  current?: string;
}) {
  return implementedDestination(id) ||
    process.env.NODE_ENV === "development" ? (
    <a
      href={destinationPath(id)}
      aria-current={current === destinationPath(id) ? "page" : undefined}
    >
      {destinations[id][0]}
    </a>
  ) : (
    <span aria-disabled="true">
      {destinations[id][0]} <small>Pending</small>
    </span>
  );
}
export function Wordmark({ home }: { home?: boolean }) {
  return (
    <Link
      prefetch={false}
      className="public-mark"
      href="/"
      aria-label="AURA home"
      aria-current={home ? "page" : undefined}
    >
      AURA<span aria-hidden="true">.</span>
    </Link>
  );
}
