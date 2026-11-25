import "server-only";
export function securityEvent(event: "identity_denied") {
  console.warn(
    JSON.stringify({
      category: "security",
      event,
      time: new Date().toISOString(),
    }),
  );
}
