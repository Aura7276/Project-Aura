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
      <div className="identity-spread">
        <aside className="identity-print" aria-hidden="true">
          <svg viewBox="0 0 400 460" fill="none" focusable="false">
            <g stroke="currentColor" strokeWidth="1.4">
              {Array.from({ length: 19 }, (_, i) => (
                <ellipse
                  key={i}
                  cx="200"
                  cy="230"
                  rx="69"
                  ry="167"
                  transform={`rotate(${i * 9.5} 200 230)`}
                />
              ))}
            </g>
          </svg>
          <span>Aura.</span>
        </aside>
        <article>
          <Suspense>
            <PrivateNotice />
          </Suspense>
          {children}
        </article>
      </div>
    </main>
  );
}
