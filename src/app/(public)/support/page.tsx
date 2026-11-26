import { Editorial, PathLink } from "@/components/public/editorial";
export const metadata = { title: "Support centre" };
export default function Page() {
  return (
    <Editorial title="Support centre">
      <nav className="help-index" aria-label="Related pages">
        <PathLink href="/register">Create an account</PathLink>
        <PathLink href="/forgot-password">Reset your password</PathLink>
        <PathLink href="/privacy">Privacy and sharing</PathLink>
        <PathLink href="/faq">Frequently asked questions</PathLink>
        <PathLink href="/contact">Contact support</PathLink>
        <PathLink href="/resources">Browse the resource library</PathLink>
      </nav>
    </Editorial>
  );
}
