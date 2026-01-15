"use client";

import type { ReactNode } from "react";
import Button from "./Button";
import ButtonRow from "./ButtonRow";
import Modal from "./Modal";
import Notice from "./Notice";
import styles from "../clients/clients.module.css";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  portalTarget?: HTMLElement | null;
  confirmDanger?: boolean;
};

export default function ConfirmDialog({
  open,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  portalTarget,
  confirmDanger = false
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      portalTarget={portalTarget}
      className={styles.confirmModal}
    >
      <Notice>{message}</Notice>
      <ButtonRow>
        <Button
          variant="secondary"
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
        >
          {cancelLabel}
        </Button>
        <Button danger={confirmDanger} type="button" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </ButtonRow>
    </Modal>
  );
}
