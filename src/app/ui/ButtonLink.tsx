"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import styles from "../clients/clients.module.css";

type ButtonLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "className" | "href"
> & {
  href: string;
  variant?: "primary" | "secondary";
  danger?: boolean;
  external?: boolean;
  className?: string;
};

export default function ButtonLink({
  href,
  variant = "secondary",
  danger = false,
  external = false,
  className,
  ...props
}: ButtonLinkProps) {
  const classes = [
    variant === "secondary" ? styles.buttonSecondary : styles.button,
    danger ? styles.buttonDanger : "",
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  if (external) {
    return <a href={href} className={classes} {...props} />;
  }

  return <Link href={href} className={classes} {...props} />;
}
