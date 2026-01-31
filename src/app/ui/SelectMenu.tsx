"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../clients/clients.module.css";

type SelectOption = {
  value: string;
  label: string;
};

type SelectMenuProps = {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  selectedLabel?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  itemActiveClassName?: string;
  itemSelectedClassName?: string;
};

export default function SelectMenu({
  value,
  options,
  placeholder = "Select option",
  selectedLabel,
  disabled = false,
  onChange,
  className,
  buttonClassName,
  listClassName,
  itemClassName,
  itemActiveClassName,
  itemSelectedClassName
}: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;
  const resolvedSelectedLabel =
    selectedLabel ?? selectedOption?.label ?? placeholder;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (activeIndex >= 0 && activeIndex < options.length) {
      return;
    }
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }
    setActiveIndex(options.length ? 0 : -1);
  }, [open, activeIndex, options, selectedIndex]);

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    setOpen((prev) => !prev);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((prev) =>
        Math.min(prev + 1, Math.max(options.length - 1, 0))
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (activeIndex >= 0 && activeIndex < options.length) {
        handleSelect(options[activeIndex].value);
      }
      return;
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    }
  };

  const rootClasses = [styles.selectMenu, className ?? ""].filter(Boolean).join(" ");
  const triggerClasses = [
    styles.select,
    styles.selectMenuTrigger,
    buttonClassName ?? ""
  ]
    .filter(Boolean)
    .join(" ");
  const listClasses = [styles.selectMenuList, listClassName ?? ""]
    .filter(Boolean)
    .join(" ");
  const optionClasses = [styles.selectMenuItem, itemClassName ?? ""]
    .filter(Boolean)
    .join(" ");
  const optionActiveClasses = [
    styles.selectMenuItemActive,
    itemActiveClassName ?? ""
  ]
    .filter(Boolean)
    .join(" ");
  const optionSelectedClasses = [
    styles.selectMenuItemSelected,
    itemSelectedClassName ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClasses} ref={rootRef}>
      <button
        className={triggerClasses}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={styles.selectMenuLabel}>{resolvedSelectedLabel}</span>
        <span className={styles.selectMenuCaret} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul
          className={listClasses}
          role="listbox"
          onMouseLeave={() =>
            setActiveIndex(selectedIndex >= 0 ? selectedIndex : -1)
          }
          onMouseMove={(event) => {
            if (event.target === event.currentTarget) {
              setActiveIndex(selectedIndex >= 0 ? selectedIndex : -1);
            }
          }}
        >
          {options.length === 0 && (
            <li className={styles.selectMenuEmpty}>No options</li>
          )}
          {options.map((option, index) => {
            const isActive = index === activeIndex;
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  className={[
                    optionClasses,
                    isActive ? optionActiveClasses : "",
                    isSelected && index === activeIndex ? optionSelectedClasses : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => {
                    if (event.button !== 0) {
                      return;
                    }
                    event.preventDefault();
                    handleSelect(option.value);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
