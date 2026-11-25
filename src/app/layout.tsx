import type { Metadata } from "next";
import { connection } from "next/server";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "AURA · Foundation",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
