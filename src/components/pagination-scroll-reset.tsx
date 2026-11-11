"use client";

import { useEffect } from "react";

/**
 * Keeps paginated result browsing predictable across the marketplace:
 * after activating a Next/التالي pagination control, show the start of
 * the newly loaded result set instead of leaving the user at the footer.
 */
export default function PaginationScrollReset() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("button, a");
      if (!(control instanceof HTMLElement)) return;

      const label = [
        control.innerText,
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.getAttribute("rel")
      ].filter(Boolean).join(" ").replace(/\\s+/g, " ").trim().toLocaleLowerCase();

      const isNextPage =
        control.getAttribute("rel")?.toLowerCase() === "next" ||
        /^(next|التالي|الصفحة التالية|next page)$/.test(label);

      if (!isNextPage || control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return;

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
