import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Privacy" };
export default function Page() {
  return (
    <Editorial
      title="Privacy"
      intro="The public privacy notice is awaiting approval. For questions about profile visibility or private information, visit the support centre."
    >
      <PathLink href="/support">Visit the support centre</PathLink>
    </Editorial>
  );
}
