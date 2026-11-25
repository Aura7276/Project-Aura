// A validated return destination for a future registration handoff. It grants no permissions.
export function entryIntent(kind: "campaign" | "invite", value: string) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(value)) return null;
  return { kind, value, returnTo: "/" + kind + "/" + value } as const;
}
