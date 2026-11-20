import { Suspense } from "react";
import AskView from "@/components/AskView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AskView />
    </Suspense>
  );
}
