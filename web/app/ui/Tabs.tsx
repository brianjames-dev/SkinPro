"use client";

import styles from "../clients/clients.module.css";

type TabItem<T extends string = string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type TabsProps<T extends string = string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  buttonClassName?: string;
  buttonActiveClassName?: string;
  as?: "div" | "nav";
};

export default function Tabs<T extends string = string>({
  tabs,
  value,
  onChange,
  className,
  buttonClassName,
  buttonActiveClassName,
  as = "div"
}: TabsProps<T>) {
  const baseButtonClass = buttonClassName ?? styles.tabButton;
  const activeButtonClass = buttonActiveClassName ?? styles.tabButtonActive;
  const Container = as;

  return (
    <Container className={className} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === value;
        const classes = [
          baseButtonClass,
          isActive ? activeButtonClass : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={tab.id}
            className={classes}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        );
      })}
    </Container>
  );
}
