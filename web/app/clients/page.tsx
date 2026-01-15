import Link from "next/link";
import { Suspense } from "react";
import ClientsDashboard from "./clients-dashboard";

export default function ClientsPage() {
  return (
    <main>
      <div style={{ marginBottom: "16px" }}>
        <Link href="/">Back to Dashboard</Link>
      </div>
      <h1>Workspace</h1>
      <Suspense fallback={null}>
        <ClientsDashboard />
      </Suspense>
    </main>
  );
}
