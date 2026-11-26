import { notFound } from "next/navigation";
import { ContentStudio } from "@/features/content-studio/studio";
import { fresh, dayKey, type Item } from "@/features/content-studio/model";
export const metadata = { title: "Content Studio preview" };
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  const names = [
    "A field guide to better light",
    "Inside the editing room",
    "Five frames from the flower market",
    "Notes from a Sunday shoot",
  ];
  const initial = names.map((title, n) => {
    const date = new Date();
    date.setDate(date.getDate() + n);
    const item: Item = {
      ...fresh(),
      title,
      day: dayKey(date),
      format: (["Reel", "Short", "Carousel", "Story"] as const)[n],
      stage: (["Editing", "Drafting", "Review", "Idea"] as const)[n],
      pillar: n % 2 ? "Behind the scenes" : "Field notes",
      body:
        n === 0
          ? "Opening shot: a window at first light.\n\nCompare the same subject in direct sun and open shade."
          : "",
    };
    return { item, revision: 1 };
  });
  return (
    <main>
      <ContentStudio
        preview
        initial={initial}
        ideas={[
          {
            id: crypto.randomUUID(),
            title: "The tools in my camera bag",
            note: "Build a short walkthrough around three essentials.",
          },
        ]}
      />
    </main>
  );
}
