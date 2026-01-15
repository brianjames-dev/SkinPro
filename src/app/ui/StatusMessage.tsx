"use client";

import type { HTMLAttributes, ReactNode } from "react";
import styles from "../clients/clients.module.css";

type StatusMessageProps = HTMLAttributes<HTMLParagraphElement> & {
  children: ReactNode;
};

export default function StatusMessage({
  children,
  className,
  ...rest
}: StatusMessageProps) {
  const classes = [styles.status, className ?? ""].filter(Boolean).join(" ");
  return (
    <p className={classes} {...rest}>
      {children}
    </p>
  );
}
