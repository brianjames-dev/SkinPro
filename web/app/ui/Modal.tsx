"use client";

import { useId, useMemo } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import styles from "../clients/clients.module.css";
import IconButton from "./IconButton";

type ModalProps = {
  open: boolean;
  title?: string;
  onClose?: () => void;
  portalTarget?: HTMLElement | null;
  children: ReactNode;
  className?: string;
};

export default function Modal({
  open,
  title,
  onClose,
  portalTarget,
  children,
  className
}: ModalProps) {
  const titleId = useId();
  const target = useMemo(() => {
    if (portalTarget !== undefined) {
      return portalTarget;
    }
    if (typeof document === "undefined") {
      return null;
    }
    return document.body;
  }, [portalTarget]);

  if (!open || !target) {
    return null;
  }

  return createPortal(
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={onClose}
    >
      <div
        className={[styles.modal, className ?? ""].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        {(title || onClose) && (
          <div className={styles.modalHeader}>
            {title ? (
              <h3 id={titleId} className={styles.modalTitle}>
                {title}
              </h3>
            ) : (
              <span />
            )}
            {onClose && (
              <IconButton onClick={onClose} aria-label="Close" title="Close">
                X
              </IconButton>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    target
  );
}
