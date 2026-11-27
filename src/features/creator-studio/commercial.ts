// The commercial summary is sourced only from authoritative M13 records. M13 is not built, so the production source reports
// "unavailable". That is distinct from "no records", and no earnings, balances or payments are ever shown or invented.
export type CommercialSummary =
  | {
      status: "exact";
      currency: string;
      agreed: string;
      received: string;
      outstanding: string;
    }
  | { status: "unavailable"; module: "M13"; text: string }
  | { status: "none"; text: string }
  | {
      status: "records";
      currency: string;
      agreed_minor: number;
      recorded_payments_minor: number;
      outstanding_minor: number;
    };
export interface CommercialSource {
  summary(workspaceId: string): Promise<CommercialSummary>;
}
export const unavailableCommercial: CommercialSource = {
  async summary() {
    return {
      status: "unavailable",
      module: "M13",
      text: "Agreed compensation, externally recorded payments and outstanding amounts will appear here when commercial records exist. AURA does not hold or move money.",
    };
  },
};
