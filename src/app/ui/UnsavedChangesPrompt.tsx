"use client";

import Modal from "./Modal";
import Notice from "./Notice";
import Button from "./Button";
import ButtonRow from "./ButtonRow";
import styles from "../clients/clients.module.css";

type UnsavedChangesPromptProps = {
  open: boolean;
  title?: string;
  message?: string;
  discardLabel?: string;
  saveLabel?: string;
  stayLabel?: string;
  onDiscard: () => void;
  onSave: () => void;
  onStay: () => void;
  portalTarget?: HTMLElement | null;
};

export default function UnsavedChangesPrompt({
  open,
  title = "Unsaved Changes",
  message = "Would you like to save before exiting?",
  discardLabel = "Exit without Saving",
  saveLabel = "Save and Exit",
  stayLabel = "Keep Editing",
  onDiscard,
  onSave,
  onStay,
  portalTarget
}: UnsavedChangesPromptProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onStay}
      portalTarget={portalTarget}
      className={styles.confirmModal}
    >
      <Notice>{message}</Notice>
      <ButtonRow>
        <Button type="button" onClick={onSave}>
          {saveLabel}
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={onDiscard}
          className={styles.cancelButton}
        >
          {discardLabel}
        </Button>
        <Button variant="secondary" type="button" onClick={onStay}>
          {stayLabel}
        </Button>
      </ButtonRow>
    </Modal>
  );
}
