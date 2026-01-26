"use client";

import { useCallback, useMemo, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import {
  applyDisplayChangeToRaw,
  stripHighlightTokens
} from "@/lib/highlightText";
import styles from "./HighlightTextarea.module.css";

type HighlightTextareaProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  showClearButton?: boolean;
  clearLabel?: string;
  textareaClassName?: string;
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement> &
    Record<string, unknown>;
};

export default function HighlightTextarea({
  value,
  placeholder,
  onChange,
  onFocus,
  onBlur,
  showClearButton = true,
  clearLabel = "Clear highlights",
  textareaClassName,
  textareaProps
}: HighlightTextareaProps) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const strippedValue = useMemo(() => stripHighlightTokens(value ?? ""), [value]);
  const hasHighlights = useMemo(
    () => (value ?? "").includes("[[highlight]]"),
    [value]
  );
  const { className: textareaPropsClassName, ...restTextareaProps } =
    textareaProps ?? {};
  const mergedTextareaClassName = [
    styles.textarea,
    textareaClassName ?? "",
    textareaPropsClassName ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLTextAreaElement>) => {
      if (mirrorRef.current) {
        mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
      }
    },
    []
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(applyDisplayChangeToRaw(value ?? "", event.target.value));
    },
    [onChange, value]
  );

  const renderHighlights = useMemo(() => {
    const tokens = (value ?? "").split(
      /(\[\[highlight\]\]|\[\[\/highlight\]\])/
    );
    const nodes: React.ReactNode[] = [];
    let isHighlighted = false;
    tokens.forEach((token, index) => {
      if (token === "[[highlight]]") {
        isHighlighted = true;
        return;
      }
      if (token === "[[/highlight]]") {
        isHighlighted = false;
        return;
      }
      if (!token) {
        return;
      }
      nodes.push(
        <span className={isHighlighted ? styles.highlight : undefined} key={index}>
          {token}
        </span>
      );
    });
    return nodes;
  }, [value]);

  const handleClear = useCallback(() => {
    onChange(strippedValue);
  }, [onChange, strippedValue]);

  return (
    <div className={styles.wrap}>
      <div className={styles.surface}>
        <div ref={mirrorRef} className={styles.mirror} aria-hidden="true">
          {renderHighlights}
        </div>
        <textarea
          className={mergedTextareaClassName}
          placeholder={placeholder}
          value={strippedValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onScroll={handleScroll}
          {...restTextareaProps}
        />
      </div>
      {showClearButton && hasHighlights && (
        <button
          type="button"
          className={styles.clearButton}
          aria-label={clearLabel}
          onClick={handleClear}
        >
          ✕
        </button>
      )}
    </div>
  );
}
