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
  if (!intent) return null;
  const query = new URLSearchParams({ kind, value });
  return (
    <PathLink
      href={"/" + (kind === "invite" ? "register" : "login") + "?" + query}
    >
      Continue to {kind === "invite" ? "registration" : "sign-in"}
    </PathLink>
  );
}
