"use client";

type TogglePillItem<T extends string = string> = {
  id: T;
  label: string;
  disabled?: boolean;
};

type TogglePillProps<T extends string = string> = {
  items: readonly TogglePillItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  buttonClassName?: string;
  buttonActiveClassName?: string;
};

export default function TogglePill<T extends string = string>({
  items,
  value,
  onChange,
  className,
  buttonClassName,
  buttonActiveClassName
}: TogglePillProps<T>) {
  return (
    <div className={className} role="group">
      {items.map((item) => {
        const isActive = item.id === value;
        const classes = [
          buttonClassName ?? "",
          isActive ? buttonActiveClassName ?? "" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={item.id}
            className={classes}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={isActive}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
