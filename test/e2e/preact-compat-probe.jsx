import { createElement as h } from "react";
import { createRoot } from "react-dom/client";

// Isolated compatibility probes, bundled with the same aliases as the plugin.
// Real plugin interactions and unload behavior remain covered by the host suite.
export function eventProbe() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const calls = [];
  const shared = event => calls.push(event.currentTarget.dataset.role);
  const tree = (innerHandler, outerHandler = shared) => h("div", { "data-role": "outer", onClick: outerHandler },
    h("div", { "data-role": "inner", onClick: innerHandler },
      h("button", { onClick: () => root.render(tree(shared)) }, "Dispatch")));
  const click = () => container.querySelector("button").dispatchEvent(new MouseEvent("click", { bubbles: true }));
  try {
    root.render(tree(undefined));
    click();
    const first = calls.splice(0);
    click();
    const second = calls.splice(0);
    root.render(tree(shared, () => calls.push("replacement")));
    // The child swaps the outer handler again during dispatch. The existing
    // ancestor listener must retain its attach time and use the new callback.
    click();
    const replaced = calls.splice(0);
    const detachedButton = container.querySelector("button");
    root.unmount();
    detachedButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return { first, second, replaced, afterUnmount: calls.splice(0) };
  } finally {
    root.unmount();
    container.remove();
  }
}

export function refProbe() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const calls = [];
  const ref = node => {
    if (!node) {
      calls.push("unexpected null");
      return;
    }
    const id = node.dataset.item;
    calls.push(`attach ${id}`);
    return () => calls.push(`cleanup ${id}`);
  };
  const tree = ids => h("div", null, ids.map(id => h("span", { key: id, "data-item": id, ref }, id)));
  try {
    root.render(tree(["a", "b"]));
    const mounted = calls.splice(0);
    root.render(tree(["b"]));
    const removed = calls.splice(0);
    root.render(tree(["a", "b"]));
    const remounted = calls.splice(0);
    root.unmount();
    const unmounted = calls.splice(0);
    root.unmount();
    return { mounted, removed, remounted, unmounted, repeatedUnmount: calls.splice(0) };
  } finally {
    root.unmount();
    container.remove();
  }
}
