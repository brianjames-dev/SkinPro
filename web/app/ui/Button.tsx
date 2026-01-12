"use client";

import type { ButtonHTMLAttributes } from "react";
import styles from "../clients/clients.module.css";

type ButtonVariant = "primary" | "secondary";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  danger?: boolean;
};

export default function Button({
  variant = "primary",
  danger = false,
  className,
  ...props
}: ButtonProps) {
  const classes = [
    variant === "secondary" ? styles.buttonSecondary : styles.button,
    danger ? styles.buttonDanger : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}
