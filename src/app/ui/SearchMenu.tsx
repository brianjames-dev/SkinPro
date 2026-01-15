"use client";

import type { ReactNode } from "react";
import Notice from "./Notice";
import ListRowButton from "./ListRowButton";

type SearchMenuProps<T> = {
  show: boolean;
  items: T[];
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  getMeta?: (item: T) => string | null | undefined;
  onSelect: (item: T) => void;
  activeIndex?: number;
  selectedId?: string | number | null;
  onActiveIndexChange?: (index: number) => void;
  containerClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  itemActiveClassName?: string;
  itemSelectedClassName?: string;
  labelClassName?: string;
  metaClassName?: string;
  emptyClassName?: string;
  labelElement?: "div" | "span";
  metaElement?: "div" | "span";
  renderMeta?: (item: T) => ReactNode;
};

export default function SearchMenu<T>({
  show,
  items,
  loading = false,
  loadingMessage = "Loading...",
  emptyMessage = "No results",
  getKey,
  getLabel,
  getMeta,
  onSelect,
  activeIndex = -1,
  selectedId = null,
  onActiveIndexChange,
  containerClassName,
  listClassName,
  itemClassName,
  itemActiveClassName,
  itemSelectedClassName,
  labelClassName,
  metaClassName,
  emptyClassName,
  labelElement = "span",
  metaElement = "span",
  renderMeta
}: SearchMenuProps<T>) {
  if (!show) {
    return null;
  }

  const containerClasses = containerClassName ?? "";
  const listClasses = listClassName ?? "";
  const emptyClasses = emptyClassName ?? "";
  const Label = labelElement;
  const Meta = metaElement;

  if (loading) {
    return (
      <div className={containerClasses}>
        <Notice as="div">{loadingMessage}</Notice>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={containerClasses}>
        <div className={emptyClasses}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <ul className={listClasses}>
        {items.map((item, index) => {
          const key = getKey(item);
          const isSelected = selectedId !== null && key === selectedId;
          const isActive = index === activeIndex;
          const label = getLabel(item);
          const meta = renderMeta ? renderMeta(item) : getMeta?.(item);

          return (
            <li key={String(key)}>
              <ListRowButton
                type="button"
                baseClassName={itemClassName}
                active={isActive}
                selected={isSelected}
                activeClassName={itemActiveClassName}
                selectedClassName={itemSelectedClassName}
                onMouseEnter={() => {
                  if (onActiveIndexChange) {
                    onActiveIndexChange(index);
                  }
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(item);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item);
                  }
                }}
                aria-selected={isSelected || isActive}
              >
                <Label className={labelClassName}>{label}</Label>
                {meta ? <Meta className={metaClassName}>{meta}</Meta> : null}
              </ListRowButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
