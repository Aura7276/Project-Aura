import Link from "next/link";
import "@/features/creator-onboarding/onboarding.css";
export const metadata = {
  title: "Creator onboarding · AURA",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ob">
      <header className="ob-top">
        <Link href="/">AURA</Link>
        <small>Creator onboarding</small>
      </header>
      <main className="ob-main" id="content">
        {children}
      </main>
    </div>
  );
}
