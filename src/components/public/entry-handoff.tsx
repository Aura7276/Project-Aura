import { entryIntent } from "@/features/public-site/intent";
import { PathLink } from "./editorial";
export function EntryHandoff({
  kind,
  value,
}: {
  kind: "invite" | "campaign";
  value: string;
}) {
  const intent = entryIntent(kind, value);
  if (!intent || process.env.NODE_ENV !== "development") return null;
  const query = new URLSearchParams({ kind, value });
  return (
    <PathLink
      href={
        "/readiness/" + (kind === "invite" ? "register" : "login") + "?" + query
      }
    >
      View {kind === "invite" ? "registration" : "sign-in"} readiness
    </PathLink>
  );
}
