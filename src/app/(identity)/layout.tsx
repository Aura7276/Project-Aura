import { Suspense } from "react";
import { PrivateNotice } from "@/features/auth/private-notice";
import Link from "next/link";
import "./identity.css";
export const metadata = { robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="identity-shell">
      <header>
        <Link href="/">AURA</Link>
        <span>Account studio</span>
      </header>
      <article>
        <Suspense>
          <PrivateNotice />
        </Suspense>
        {children}
      </article>
    </main>
  );
}
