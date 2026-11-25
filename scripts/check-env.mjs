import { providerConfig } from "../src/config/environment.ts";
try {
  const { url, key } = providerConfig();
  console.log("Supabase public environment validated.");
  if (process.argv.includes("--connect")) {
    for (const [service, path] of [
      ["Auth settings", "/auth/v1/settings"],
      ["PostgREST schema", "/rest/v1/"],
    ]) {
      const response = await fetch(new URL(path, url), {
        headers: { apikey: key },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error(service + " returned HTTP " + response.status);
      const payload = await response.json();
      if (
        service === "Auth settings"
          ? !payload.external
          : !(payload.swagger || payload.openapi)
      )
        throw new Error("Unexpected " + service + " response");
      console.log(service + " responded successfully.");
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
