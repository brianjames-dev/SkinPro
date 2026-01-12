"use client";

import type { HTMLAttributes, ReactNode } from "react";

type BadgeProps = HTMLAttributes<HTMLElement> & {
  as?: "span" | "div";
  baseClassName?: string;
  toneClassName?: string;
  children: ReactNode;
};

export default function Badge({
  as = "span",
  baseClassName,
  toneClassName,
  className,
  children,
  ...rest
}: BadgeProps) {
  const Component = as;
  const classes = [baseClassName, toneClassName, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
