import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Terms" };
export default function Page() {
  return (
    <Editorial
      title="Terms"
      intro="The public terms of service are awaiting approval. Commercial agreements and account registration are unavailable on this website."
    >
      <PathLink href="/support">Visit the support centre</PathLink>
    </Editorial>
  );
}
