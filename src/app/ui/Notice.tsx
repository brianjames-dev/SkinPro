"use client";

import type { ReactNode } from "react";
import styles from "../clients/clients.module.css";

type NoticeProps = {
  as?: "p" | "span" | "div";
  className?: string;
  children: ReactNode;
};

export default function Notice({
  as = "p",
  className,
  children
}: NoticeProps) {
  const Component = as;
  const classes = [styles.notice, className ?? ""].filter(Boolean).join(" ");

  return <Component className={classes}>{children}</Component>;
}
