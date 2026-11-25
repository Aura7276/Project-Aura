import { Editorial } from "@/components/public/editorial";
import { Walkthrough } from "./walkthrough";
export const metadata = { title: "Product walkthrough" };
export default function Demo() {
  return (
    <Editorial
      title="Take a studio walkthrough"
      intro="Choose a journey and explore the steps. Each example is illustrative. Your selections stay on this page."
    >
      <Walkthrough />
    </Editorial>
  );
}
