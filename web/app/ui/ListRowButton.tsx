"use client";

import type { ButtonHTMLAttributes } from "react";

type ListRowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  selected?: boolean;
  activeClassName?: string;
  selectedClassName?: string;
  baseClassName?: string;
};

export default function ListRowButton({
  active = false,
  selected = false,
  activeClassName,
  selectedClassName,
  baseClassName,
  className,
  ...rest
}: ListRowButtonProps) {
  const classes = [
    baseClassName ?? "",
    className ?? "",
    selected ? selectedClassName ?? "" : "",
    active ? activeClassName ?? "" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...rest} />;
}
