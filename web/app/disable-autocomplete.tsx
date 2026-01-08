"use client";

import { useEffect } from "react";

const INPUT_TYPES_TO_SKIP = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit"
]);

const disableAutocomplete = (
  element: HTMLInputElement | HTMLTextAreaElement
) => {
  element.setAttribute("autocomplete", "off");
  element.setAttribute("autocapitalize", "off");
  element.setAttribute("autocorrect", "off");
  element.setAttribute("spellcheck", "false");
};

const applyToInputs = (root: ParentNode) => {
  root.querySelectorAll("input").forEach((input) => {
    const type = input.getAttribute("type")?.toLowerCase() ?? "text";
    if (INPUT_TYPES_TO_SKIP.has(type)) {
      return;
    }
    disableAutocomplete(input);
  });

  root.querySelectorAll("textarea").forEach((textarea) => {
    disableAutocomplete(textarea);
  });
};

export default function DisableAutocomplete() {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    applyToInputs(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          applyToInputs(node);
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
