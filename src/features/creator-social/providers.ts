// Provider-independent integration contracts. NO provider is implemented: no OAuth credential exists, no platform API is called, nothing is scraped.
// Intended order: Instagram, then YouTube, then others by demand. Each dependency is listed in SOCIAL_ACCOUNT_ARCHITECTURE.md.
export type ProviderCode =
  "instagram" | "youtube" | "facebook" | "linkedin" | "threads";
export type ProviderCapabilities = {
  accountMetrics: readonly string[];
  contentMetrics: readonly string[];
  publishing: boolean;
  dailyRefresh: boolean;
  manualRefreshPerDay: number;
};
export type ProviderFailure = {
  kind:
    | "rate_limited"
    | "token_expired"
    | "scope_missing"
    | "provider_unavailable"
    | "account_not_found";
  retryAfterSeconds?: number;
};
export interface ProviderAdapter {
  readonly code: ProviderCode;
  capabilities(): ProviderCapabilities;
  /** Begin the provider's own authorization flow. Never accepts a password, cookie or unofficial token. */
  beginAuthorization(input: {
    workspaceId: string;
    accountId: string;
    redirectUri: string;
  }): Promise<{ authorizationUrl: string; state: string }>;
  completeAuthorization(input: { state: string; code: string }): Promise<{
    providerAccountId: string;
    credentialRef: string;
    scopes: string[];
  }>;
  fetchAccount(credentialRef: string): Promise<{
    providerAccountId: string;
    handle: string;
    accountType?: string;
    followers?: number;
  }>;
  fetchAccountMetrics(
    credentialRef: string,
    window: { from: string; to: string },
  ): Promise<
    {
      metric: string;
      value: number;
      observedOn: string;
      periodStart?: string;
      periodEnd?: string;
    }[]
  >;
  fetchContentMetrics(
    credentialRef: string,
    externalIds: string[],
  ): Promise<
    {
      externalId: string;
      metric: string;
      value: number;
      observedOn: string;
      window: "lifetime" | "window";
    }[]
  >;
  validateScopes(
    credentialRef: string,
    required: string[],
  ): Promise<{ ok: boolean; missing: string[] }>;
  revoke(credentialRef: string): Promise<void>;
}
export const registeredProviders: readonly ProviderAdapter[] = []; // none registered
export const providerStatus = (code: string) => ({
  code,
  available: false as const,
  reason:
    "No platform connection is available yet. Your account works fully with manual tracking.",
});
/** Refresh runner contract: every step revalidates the account, so a job that finishes after disconnection is discarded. */
export interface RefreshRunner {
  run(jobId: string): Promise<{
    status: "succeeded" | "failed" | "cancelled";
    errorCode?: string;
  }>;
}
/** Opt-in publishing contract only. Nothing publishes during M05: it needs explicit approval, supported scopes, approved content and an exact destination. */
export interface PublishingAdapter {
  publish(input: {
    accountId: string;
    destination: string;
    contentId: string;
    approvedBy: string;
  }): Promise<{ publishedUrl: string }>;
}
export const publishingAvailability = () => ({
  available: false as const,
  reason:
    "Publishing from AURA is not available. It will always need your explicit approval for each post.",
});
