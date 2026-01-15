"use client";

import type { PropsWithChildren } from "react";
import styles from "../clients/clients.module.css";

type ButtonRowProps = PropsWithChildren<{
  className?: string;
}>;

export default function ButtonRow({ className, children }: ButtonRowProps) {
  const classes = [styles.buttonRow, className ?? ""].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}
