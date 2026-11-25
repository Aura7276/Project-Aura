import { z } from "zod";
import { Editorial, PathLink } from "@/components/public/editorial";
import { ContactDraft } from "./draft";
export const metadata = { title: "Contact support" };
export default function Contact() {
  const email = z.email().safeParse(process.env.AURA_SUPPORT_EMAIL);
  return (
    <Editorial
      title="Contact support"
      intro="Prepare a short enquiry. Leave out passwords, verification documents and payment details."
    >
      <ContactDraft address={email.success ? email.data : null} />
      <PathLink href="/support">Support centre</PathLink>
    </Editorial>
  );
}
