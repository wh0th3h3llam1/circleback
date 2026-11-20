import { Suspense } from "react";
import PeopleView from "@/components/PeopleView";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PeopleView />
    </Suspense>
  );
}
