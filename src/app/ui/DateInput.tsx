"use client";

import type { InputHTMLAttributes } from "react";
import { formatDateInput } from "@/lib/format";
import { parseDateParts } from "@/lib/parse";
import styles from "../clients/clients.module.css";

type DateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

const formatIsoDateForInput = (value: string) => {
  const parts = parseDateParts(value);
  if (!parts) {
    return "";
  }
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;
};

const formatInputDateAsMmddyyyy = (value: string) => {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "";
  }
  return `${month}/${day}/${year}`;
};

export default function DateInput({
  value,
  onChange,
  className,
  disabled,
  placeholder = "MM/DD/YYYY",
  ...props
}: DateInputProps) {
  const textClasses = [
    styles.input,
    styles.datePickerTextInput,
    className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.datePickerField}>
      <input
        {...props}
        className={textClasses}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(formatDateInput(event.target.value))}
      />
      <input
        className={styles.nativeDateInput}
        type="date"
        aria-label={props["aria-label"] ? `Pick ${props["aria-label"]}` : "Pick date"}
        value={formatIsoDateForInput(value)}
        onChange={(event) => onChange(formatInputDateAsMmddyyyy(event.target.value))}
        disabled={disabled}
      />
    </div>
  );
}
