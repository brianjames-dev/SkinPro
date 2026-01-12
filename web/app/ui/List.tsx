"use client";

import type { ReactNode } from "react";

type ListProps = {
  as?: "ul" | "ol" | "div";
  className?: string;
  children: ReactNode;
};

export default function List({ as = "ul", className, children }: ListProps) {
  const Component = as;
  return <Component className={className}>{children}</Component>;
}
