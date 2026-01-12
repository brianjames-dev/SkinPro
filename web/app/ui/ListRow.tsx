"use client";

import type { HTMLAttributes, ReactNode } from "react";

type ListRowProps = HTMLAttributes<HTMLElement> & {
  as?: "li" | "div";
  active?: boolean;
  selected?: boolean;
  activeClassName?: string;
  selectedClassName?: string;
  children: ReactNode;
};

export default function ListRow({
  as = "li",
  active = false,
  selected = false,
  activeClassName,
  selectedClassName,
  className,
  children,
  ...rest
}: ListRowProps) {
  const Component = as;
  const classes = [
    className ?? "",
    selected ? selectedClassName ?? "" : "",
    active ? activeClassName ?? "" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
