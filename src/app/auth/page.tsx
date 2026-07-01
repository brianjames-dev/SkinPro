"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./auth.module.css";
import Button from "../ui/Button";
import Field from "../ui/Field";
import Notice from "../ui/Notice";
import StatusMessage from "../ui/StatusMessage";

/** Client-side mirror of sanitizeNextPath — only same-origin relative paths. */
function safeNextPath(raw: string | null): string {
  if (!raw) {
    return "/";
  }
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return "/";
    }
  } catch {
    return "/";
  }
  return value;
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = useMemo(
    () => safeNextPath(searchParams.get("next")),
    [searchParams]
  );
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
    <div className={styles.shell}>
      <section className={styles.modal} aria-labelledby="auth-title">
        <h1 id="auth-title" className={styles.title}>
          Unlock SkinPro
        </h1>
        <Notice>Enter your access PIN to continue.</Notice>
        {error && <StatusMessage>{error}</StatusMessage>}
        <form className={styles.form} onSubmit={handleSubmit}>
          <Field label="Access PIN">
            <input
              className={styles.input}
              type="password"
              inputMode="numeric"
              name="pin"
              autoComplete="current-password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="••••"
              autoFocus
            />
          </Field>
          <div className={styles.actions}>
            <Button type="submit" disabled={loading || !pin.trim()}>
              {loading ? "Unlocking..." : "Unlock"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className={styles.shell} aria-hidden />}>
      <AuthContent />
    </Suspense>
  );
}
