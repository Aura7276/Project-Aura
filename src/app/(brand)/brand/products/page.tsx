import { ProductsView } from "@/features/brand/views";
export const metadata = { title: "Products" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductsView sp={await searchParams} />;
}
