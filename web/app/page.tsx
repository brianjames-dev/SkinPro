import { Suspense } from "react";
import HomeView from "./home";

export default function Home() {
  return (
    <main>
      <Suspense fallback={null}>
        <HomeView />
      </Suspense>
    </main>
  );
}
