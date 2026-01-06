import Link from "next/link";
import { Suspense } from "react";
import ClientsDashboard from "./clients-dashboard";

export default function ClientsPage() {
  return (
    <main>
      <div style={{ marginBottom: "16px" }}>
        <Link href="/">Back to Home</Link>
      </div>
      <h1>Clients</h1>
      <Suspense fallback={null}>
        <ClientsDashboard />
      </Suspense>
    </main>
  );
}
