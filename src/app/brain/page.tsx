import { Suspense } from "react";
import BrainView from "@/components/BrainView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BrainView />
    </Suspense>
  );
}
