import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eligible } from "@/server/auth/session";
import { profileApi } from "@/server/profile/service";
import {
  kitTokenPattern,
  relationships,
} from "@/features/creator-profile/rules";
import { EntityForm } from "@/features/creator-profile/forms";
import { submitTestimonial } from "@/features/creator-profile/actions";
import "@/features/creator-profile/profile.css";
export const metadata: Metadata = {
  title: "Write a testimonial",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!kitTokenPattern.test(token)) notFound();
  const { client } = await eligible(); // signing in is required: testimonials are attributable to a real account
  const r = await profileApi.inviteInfo(client, token);
  const info = r.ok ? r.value : { valid: false };
  return (
    <div className="pf">
      <div className="pf-notice" id="profile" style={{ maxWidth: "40rem" }}>
        {!info.valid ? (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>This invitation is not valid</h1>
            <p>It may have expired, been used already, or been withdrawn.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>
              Write a testimonial for {info.display_name}
            </h1>
            <p>
              Describe real work you did together. Your name is shown with it. A
              reviewer checks it first, and the creator then chooses whether to
              show it. They cannot edit what you write.
            </p>
            <EntityForm
              action={submitTestimonial}
              label="Write a testimonial"
              idPrefix="tm"
              submit="Send testimonial"
              fields={[
                { name: "token", label: "", type: "hidden", value: token },
                {
                  name: "author_name",
                  label: "Your name as it should appear",
                  max: 80,
                  required: true,
                },
                {
                  name: "author_role",
                  label: "Your role and organisation",
                  max: 100,
                },
                {
                  name: "relationship",
                  label: "How you worked together",
                  type: "select",
                  options: relationships,
                  value: "brand_client",
                  required: true,
                },
                {
                  name: "body",
                  label: "Your testimonial",
                  type: "textarea",
                  max: 1200,
                  rows: 6,
                  required: true,
                  hint: "At least 20 characters. Be specific about what was delivered.",
                },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
}
