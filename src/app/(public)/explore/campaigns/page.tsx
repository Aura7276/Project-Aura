import { Discovery } from "@/components/public/discovery";
export const metadata = { title: "Discover campaigns" };
export default function Page() {
  return <Discovery kind="campaign" />;
}
