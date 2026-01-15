"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./share.module.css";

type ShareStatus = "idle" | "loading" | "ready" | "error";

function PrescriptionShareContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing download token.");
      return;
    }

    let isMounted = true;
    const loadImage = async () => {
      setStatus("loading");
      setError(null);
      setShareError(null);
      try {
        const response = await fetch(
          `/api/prescriptions/share-image?token=${encodeURIComponent(token)}`
        );
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load image");
        }
        const blob = await response.blob();
        if (!isMounted) {
          return;
        }
        const url = URL.createObjectURL(blob);
        setImageBlob(blob);
        setImageUrl(url);
        setStatus("ready");
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load image");
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [token]);

  const handleDownload = async () => {
    if (!imageBlob || !imageUrl) {
      return;
    }

    const file = new File([imageBlob], "prescription.png", {
      type: "image/png"
    });

    if (!window.isSecureContext) {
      setShareError("Sharing requires HTTPS on iOS.");
      return;
    }

    try {
      await navigator.share({
        files: [file],
        title: "Prescription",
        text: "Prescription image"
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to open share sheet.";
      setShareError(message);
    }
  };

  const infoText = useMemo(() => {
    if (status === "loading") {
      return "Preparing your prescription image...";
    }
    if (status === "ready") {
      return "Tap Share to send this image by text or save it to your device.";
    }
    if (status === "error") {
      return error ?? "Unable to load your prescription image.";
    }
    return "";
  }, [status, error]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Prescription Download</h1>
        <p className={styles.subtitle}>{infoText}</p>
        {status === "ready" && imageUrl && (
          <>
            <img
              className={styles.preview}
              src={imageUrl}
              alt="Prescription preview"
            />
            <button
              className={styles.downloadButton}
              type="button"
              onClick={handleDownload}
            >
              Share
            </button>
            {shareError && (
              <div className={styles.errorText}>{shareError}</div>
            )}
          </>
        )}
        {status === "error" && (
          <div className={styles.errorText}>
            {error ?? "Unable to load image."}
          </div>
        )}
      </div>
    </main>
  );
}

export default function PrescriptionSharePage() {
  return (
    <Suspense fallback={<main className={styles.page} />}>
      <PrescriptionShareContent />
    </Suspense>
  );
}
