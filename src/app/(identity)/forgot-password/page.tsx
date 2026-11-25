import { PublicScreen, type Query } from "@/features/auth/public-screen";
export default function Page({ searchParams }: { searchParams: Query }) {
  return <PublicScreen mode="forgot-password" query={searchParams} />;
}
