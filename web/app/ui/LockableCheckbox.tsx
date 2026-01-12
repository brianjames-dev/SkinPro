"use client";

import type { ChangeEventHandler } from "react";

type LockableCheckboxProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange?: (checked: boolean) => void;
  onToggleLock?: () => void;
  lockVisible?: boolean;
  lockActive?: boolean;
  lockAriaLabel?: string;
  className?: string;
  labelClassName?: string;
  lockButtonClassName?: string;
  lockButtonActiveClassName?: string;
  lockIconClassName?: string;
};

export default function LockableCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
  onToggleLock,
  lockVisible = false,
  lockActive = false,
  lockAriaLabel,
  className,
  labelClassName,
  lockButtonClassName,
  lockButtonActiveClassName,
  lockIconClassName
}: LockableCheckboxProps) {
  const handleChange: ChangeEventHandler<HTMLInputElement> | undefined = onChange
    ? (event) => onChange(event.target.checked)
    : undefined;

  const lockClasses = [lockButtonClassName ?? "", lockActive ? lockButtonActiveClassName ?? "" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={className}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={handleChange} />
      {label ? <span className={labelClassName}>{label}</span> : null}
      {lockVisible && onToggleLock && (
        <button
          className={lockClasses}
          type="button"
          onClick={onToggleLock}
          aria-label={lockAriaLabel}
        >
          <span className={lockIconClassName} aria-hidden="true" />
        </button>
      )}
    </label>
  );
}
