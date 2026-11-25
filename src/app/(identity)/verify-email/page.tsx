import { PublicScreen, type Query } from "@/features/auth/public-screen";
export default function Page({ searchParams }: { searchParams: Query }) {
  return <PublicScreen mode="verify-email" query={searchParams} />;
}
