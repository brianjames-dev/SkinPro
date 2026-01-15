"use client";

type TreeToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  expandedLabel?: string;
  collapsedLabel?: string;
};

export default function TreeToggle({
  collapsed,
  onToggle,
  className,
  expandedLabel = "Collapse",
  collapsedLabel = "Expand"
}: TreeToggleProps) {
  return (
    <button
      className={className}
      type="button"
      aria-label={collapsed ? collapsedLabel : expandedLabel}
      aria-pressed={!collapsed}
      onClick={onToggle}
    >
      {collapsed ? ">" : "v"}
    </button>
  );
}
