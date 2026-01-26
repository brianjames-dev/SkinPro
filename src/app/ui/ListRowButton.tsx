"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type ListRowButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  selected?: boolean;
  activeClassName?: string;
  selectedClassName?: string;
  baseClassName?: string;
};

const ListRowButton = forwardRef<HTMLButtonElement, ListRowButtonProps>(
  (
    {
      active = false,
      selected = false,
      activeClassName,
      selectedClassName,
      baseClassName,
      className,
      ...rest
    },
    ref
  ) => {
  const classes = [
    baseClassName ?? "",
    className ?? "",
    selected ? selectedClassName ?? "" : "",
    active ? activeClassName ?? "" : ""
  ]
    .filter(Boolean)
    .join(" ");

    return <button ref={ref} className={classes} {...rest} />;
  }
);

ListRowButton.displayName = "ListRowButton";

export default ListRowButton;
