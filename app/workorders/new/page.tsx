import { Suspense } from "react";
import WorkordersNewClient from "./WorkordersNewClient";

export default function Page() {
  return (
    <Suspense fallback={<div>Caricamento...</div>}>
      <WorkordersNewClient />
    </Suspense>
  );
}
