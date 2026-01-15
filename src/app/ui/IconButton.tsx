"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "../clients/clients.module.css";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export default function IconButton({
  className,
  type = "button",
  children,
  ...rest
}: IconButtonProps) {
  const classes = [styles.iconButton, className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...rest}>
      {children}
    </button>
  );
}
