"use client";

import type { ReactNode } from "react";
import styles from "../clients/clients.module.css";

type FieldProps = {
  label?: string;
  as?: "label" | "div";
  className?: string;
  children: ReactNode;
};

export default function Field({
  label,
  as = "label",
  className,
  children
}: FieldProps) {
  const Container = as;
  const classes = [styles.field, className ?? ""].filter(Boolean).join(" ");

  return (
    <Container className={classes}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {children}
    </Container>
  );
}
