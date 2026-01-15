"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../clients/clients.module.css";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Notice from "../ui/Notice";
import StatusMessage from "../ui/StatusMessage";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = searchParams.get("next") || "/";
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Login failed.");
      }
      router.replace(nextTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.panel}>
        <h1 className={styles.sectionTitle}>Unlock SkinPro</h1>
        <Notice>Enter your access PIN to continue.</Notice>
        {error && <StatusMessage>{error}</StatusMessage>}
        <form onSubmit={handleSubmit}>
          <Field label="Access PIN">
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              name="pin"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="••••"
            />
          </Field>
          <Button type="submit" disabled={loading || !pin.trim()}>
            {loading ? "Unlocking..." : "Unlock"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className={styles.page} />}>
      <AuthContent />
    </Suspense>
  );
}
