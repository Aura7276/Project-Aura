// Contracts for capabilities that need later modules, providers or authorization. None has an implementation; each one says so.
export type Availability = {
  available: false;
  reason: string;
  dependency: string;
};
export const competitorTracking: Availability = {
  available: false,
  reason:
    "Competitor tracking needs permitted public or authorized data, a legal review and a provider. Scraping is not used.",
  dependency: "Provider integration (after M06) and legal review",
};
export const suspiciousPatterns: Availability = {
  available: false,
  reason:
    "AURA does not accuse accounts of fraud. A future indicator may flag a measurement inconsistency for the Creator to review, never a verdict about authenticity.",
  dependency: "Provider data and a reviewed policy",
};
export const campaignMatching: Availability = {
  available: false,
  reason:
    "Matching audiences to campaigns uses only aggregates a Creator has shared for that purpose, and needs the marketplace.",
  dependency: "M10 and M16",
};
export const commercialLink: Availability = {
  available: false,
  reason:
    "Sponsored content is classified by the Creator. Linking it to collaborations and deliverables needs M12; earnings stay private until M13 authorizes them.",
  dependency: "M12 and M13",
};
export const aiClassification: Availability = {
  available: false,
  reason:
    "No AI classification provider is connected. Manual tags work fully. A future provider may only PROPOSE tags, which you review and confirm.",
  dependency: "M07",
};
export type ProposedTag = {
  content: string;
  kind: string;
  value: string;
  provider: string;
  uncertainty: { note: string } | null;
};
export interface ClassificationProvider {
  readonly id: string;
  propose(input: {
    contentId: string;
    title: string | null;
  }): Promise<ProposedTag[]>;
}
export const classificationProvider: ClassificationProvider | null = null;
/** What M07 (assistant) and M08 (content studio) may read: only records the Creator has authorized, never raw evidence. */
export type LearningRecord = {
  experiment: string;
  hypothesis: string;
  outcome: string | null;
  interpretation: string | null;
  tags: string[];
};
export const downstreamContracts = {
  m07: "Assistant may read confirmed learning records and insight evidence the Creator opens to it.",
  m08: "Content Studio may read and write structured tags on content references (same content_tag store).",
};
