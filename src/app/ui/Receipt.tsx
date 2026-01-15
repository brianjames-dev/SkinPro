"use client";

import type { ReactNode } from "react";

type ReceiptItem = {
  id?: string | number;
  name: string;
  meta?: string;
  cost?: string;
};

type ReceiptGroup = {
  id?: string | number;
  label?: string;
  items: ReceiptItem[];
};

type ReceiptClasses = {
  root?: string;
  header?: string;
  title?: string;
  date?: string;
  group?: string;
  groupLabel?: string;
  items?: string;
  item?: string;
  itemName?: string;
  itemMeta?: string;
  itemCost?: string;
  total?: string;
  totalLabel?: string;
  totalValue?: string;
};

type ReceiptProps = {
  title: string;
  date?: string;
  groups: ReceiptGroup[];
  totalLabel?: string;
  totalValue?: string;
  classes?: ReceiptClasses;
  headerAccessory?: ReactNode;
};

export default function Receipt({
  title,
  date,
  groups,
  totalLabel = "Total",
  totalValue,
  classes,
  headerAccessory
}: ReceiptProps) {
  return (
    <div className={classes?.root}>
      <div className={classes?.header}>
        <span className={classes?.title}>{title}</span>
        {date && <span className={classes?.date}>{date}</span>}
        {headerAccessory}
      </div>
      {groups.map((group, index) => (
        <div
          key={group.id ?? group.label ?? index}
          className={classes?.group}
        >
          {group.label && (
            <div className={classes?.groupLabel}>{group.label}</div>
          )}
          <div className={classes?.items}>
            {group.items.map((item, itemIndex) => (
              <div
                key={item.id ?? `${group.id ?? group.label ?? index}-${itemIndex}`}
                className={classes?.item}
              >
                <div>
                  <div className={classes?.itemName}>{item.name}</div>
                  {item.meta && (
                    <div className={classes?.itemMeta}>{item.meta}</div>
                  )}
                </div>
                {item.cost && (
                  <div className={classes?.itemCost}>{item.cost}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {totalValue && (
        <div className={classes?.total}>
          <span className={classes?.totalLabel}>{totalLabel}</span>
          <span className={classes?.totalValue}>{totalValue}</span>
        </div>
      )}
    </div>
  );
}
