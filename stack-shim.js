const pruneDuplicateNuxtRoots = () => {
  const nuxt = document.getElementById("__nuxt");

  if (!nuxt) {
    return;
  }

  const appRoots = Array.from(nuxt.children).filter((node) => {
    return (
      node instanceof HTMLElement &&
      node.tagName === "DIV" &&
      (node.querySelector("article") || node.querySelector("main"))
    );
  });

  if (appRoots.length <= 1) {
    return;
  }

  for (let index = appRoots.length - 1; index >= 1; index -= 1) {
    appRoots[index].remove();
  }
};

const startNuxtRootGuard = () => {
  pruneDuplicateNuxtRoots();

  const nuxt = document.getElementById("__nuxt");

  if (!nuxt) {
    return;
  }

  const observer = new MutationObserver(() => {
    pruneDuplicateNuxtRoots();
  });

  observer.observe(nuxt, { childList: true });

  window.addEventListener(
    "beforeunload",
    () => {
      observer.disconnect();
    },
    { once: true }
  );

  window.addEventListener("load", pruneDuplicateNuxtRoots, { once: true });
  window.setTimeout(pruneDuplicateNuxtRoots, 100);
  window.setTimeout(pruneDuplicateNuxtRoots, 1000);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startNuxtRootGuard, {
    once: true,
  });
} else {
  startNuxtRootGuard();
}

