"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./share.module.css";

type ShareStatus = "idle" | "loading" | "ready" | "error";

/** In-memory cache so React Strict Mode remounts do not re-hit the single-use API. */
const shareBlobCache = new Map<string, Blob>();

function PrescriptionShareContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Missing download token.");
      return;
    }

    let isMounted = true;
    const applyBlob = (blob: Blob) => {
      if (!isMounted) {
        return;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setImageBlob(blob);
      setImageUrl(url);
      setStatus("ready");
    };

    const loadImage = async () => {
      setStatus("loading");
      setError(null);
      setShareError(null);
      try {
        const cached = shareBlobCache.get(token);
        if (cached) {
          applyBlob(cached);
          return;
        }
        const response = await fetch(
          `/api/prescriptions/share-image?token=${encodeURIComponent(token)}`
        );
        if (!response.ok) {
          // Another in-flight request may have already consumed + cached.
          const raced = shareBlobCache.get(token);
          if (raced) {
            applyBlob(raced);
            return;
          }
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to load image");
        }
        const blob = await response.blob();
        // Cache even if unmounted so Strict Mode remount can reuse without re-fetch.
        shareBlobCache.set(token, blob);
        applyBlob(blob);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        const raced = shareBlobCache.get(token);
        if (raced) {
          applyBlob(raced);
          return;
        }
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load image");
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // Revoke object URL for this mount only; keep blob cache for Strict Mode remount.
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [token]);

  const handleShare = async () => {
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
        files: [file]
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to open share sheet.";
      setShareError(message);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "prescription.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
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
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Prescription Download</h1>
            <p className={styles.subtitle}>{infoText}</p>
          </div>
          {status === "ready" && imageUrl && (
            <div className={styles.headerActions}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={handleShare}
              >
                Share
              </button>
              <button
                className={styles.actionButton}
                type="button"
                onClick={handleDownload}
              >
                Download
              </button>
            </div>
          )}
        </header>
        {status === "ready" && imageUrl && (
          <>
            <img
              className={styles.preview}
              src={imageUrl}
              alt="Prescription preview"
            />
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
