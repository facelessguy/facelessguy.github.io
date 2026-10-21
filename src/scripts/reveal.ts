const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const revealSelector = "[data-reveal]";

if (!reduceMotion.matches && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-revealed", "true");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -48px 0px", threshold: 0.08 },
  );

  const observeNewTargets = (root: ParentNode) => {
    if (root instanceof HTMLElement && root.matches(revealSelector)) {
      root.setAttribute("data-revealed", "false");
      observer.observe(root);
    }

    root.querySelectorAll<HTMLElement>(revealSelector).forEach((target) => {
      if (target.getAttribute("data-revealed") === "true") return;
      target.setAttribute("data-revealed", "false");
      observer.observe(target);
    });
  };

  observeNewTargets(document);
  document.documentElement.classList.add("motion-ready");

  if ("MutationObserver" in window) {
    const mutations = new MutationObserver((records) => {
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) observeNewTargets(node);
        }),
      );
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pagehide", () => mutations.disconnect(), {
      once: true,
    });
  }
}
