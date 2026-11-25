import { notFound } from "next/navigation";
export default async function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  const { Preview } = await import("./preview");
  return <Preview />;
}
