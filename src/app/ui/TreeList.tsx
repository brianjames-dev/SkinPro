"use client";

import { Fragment, type ReactNode } from "react";

type TreeListGroup<T> = {
  id: string;
  items: T[];
};

type TreeListProps<T, G extends TreeListGroup<T> = TreeListGroup<T>> = {
  groups: G[];
  isCollapsed: (group: G) => boolean;
  renderGroupRow: (group: G, collapsed: boolean) => ReactNode;
  renderItemRow: (group: G, item: T) => ReactNode;
  renderSingleRow?: (group: G, item: T) => ReactNode;
};

export default function TreeList<T, G extends TreeListGroup<T> = TreeListGroup<T>>({
  groups,
  isCollapsed,
  renderGroupRow,
  renderItemRow,
  renderSingleRow
}: TreeListProps<T, G>) {
  return (
    <>
      {groups.map((group) => {
        const collapsed = isCollapsed(group);
        if (group.items.length === 1 && renderSingleRow) {
          const singleItem = group.items[0];
          if (!singleItem) {
            return null;
          }
          return <Fragment key={group.id}>{renderSingleRow(group, singleItem)}</Fragment>;
        }

        return (
          <Fragment key={group.id}>
            {renderGroupRow(group, collapsed)}
            {!collapsed &&
              group.items.map((item) => renderItemRow(group, item))}
          </Fragment>
        );
      })}
    </>
  );
}
