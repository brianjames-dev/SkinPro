"use client";

import type { ButtonHTMLAttributes } from "react";
import IconButton from "./IconButton";
import styles from "../clients/clients.module.css";

type CloseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  label?: string;
};

export default function CloseButton({
  className,
  label = "Close",
  title,
  "aria-label": ariaLabel,
  ...rest
}: CloseButtonProps) {
  const classes = [styles.closeButton, className ?? ""].filter(Boolean).join(" ");
  return (
    <IconButton
      className={classes}
      title={title ?? label}
      aria-label={ariaLabel ?? label}
      {...rest}
    >
      X
    </IconButton>
  );
}
