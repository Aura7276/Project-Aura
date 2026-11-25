import { VisualSlot } from "@/components/public/visual-slot";
import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Agency Studio" };
export default function Agencies() {
  return (
    <Editorial
      title="A studio for the clients you represent."
      intro="Agency Studio is planned for teams and independent consultants working across creator talent, brand channels and campaigns."
    >
      <div className="editor-grid">
        <VisualSlot
          asset="agency-hero"
          label="Reserved for an agency creative planning session"
          caption="Agency planning session"
        />
        <section>
          <h2>One practice, different mandates</h2>
          <p>
            Represent a talent roster, run influencer or digital marketing,
            manage social channels or produce UGC. Hybrid agencies can combine
            these services according to each client’s brief.
          </p>
          <h2>Work on behalf of a client</h2>
          <p>
            Creators and Brands retain independent workspace ownership. Each
            client must explicitly delegate the scope of access. Representation
            alone grants no access.
          </p>
        </section>
      </div>
      <section>
        <h2>Planned multi-client operations</h2>
        <p>
          Keep Creator rosters and Brand client work separate. Coordinate
          campaigns, content production, client reporting and agency commercial
          management within each mandate.
        </p>
        <PathLink href="/demo">Explore the Creator and Brand journeys</PathLink>
      </section>
    </Editorial>
  );
}
