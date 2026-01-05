import Link from "next/link";
import ClientsDashboard from "./clients-dashboard";

export default function ClientsPage() {
  return (
    <main>
      <div style={{ marginBottom: "16px" }}>
        <Link href="/">Back to Home</Link>
      </div>
      <h1>Clients</h1>
      <ClientsDashboard />
    </main>
  );
}
