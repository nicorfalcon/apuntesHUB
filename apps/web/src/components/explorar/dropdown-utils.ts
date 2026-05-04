import type { SyntheticEvent } from "react";

export function closeOtherExploreDropdowns(
  event: SyntheticEvent<HTMLDetailsElement>
) {
  const current = event.currentTarget;
  if (!current.open) return;

  const root = current.closest("[data-explore-dropdown-root]") ?? document;
  root
    .querySelectorAll<HTMLDetailsElement>("details[data-explore-dropdown][open]")
    .forEach((details) => {
      if (details !== current) details.removeAttribute("open");
    });
}
