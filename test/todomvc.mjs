import {t} from "../src/test.mjs";

t.describe("TodoMVC", () => {

  t.describe("Empty Todos", () => {
    t("should hide #main and #footer when there are no todos");
  });

  t.describe("New Todo", () => {
    let page, input, items;
    t.before(async () => {
      page = await getPage("./todomvc.html");
      input = await page.first("input", 10);
      input.value = "  take over the world  ";
      enter(input);
      items = await page.all(".todo-item");
    });

    t("should add todo items", () => {
      t.assertEqual(items.length, 1);
    });

    t("should clear input after an item is added", () => {
      t.assertEqual(items.length, 1);
      t.assertEqual(input.value, "");
    });

    t("should trim entered text", () => {
      t.assertEqual(items[0].innerHTML, "take over the world");
    });

    t("should show #main and #footer when there are todos", async () => {
      t.assert(await page.first("#main"));
      t.assert(await page.first("#footer"));
    });
  });

  t.describe("Mark all as completed", () => {
    t("should allow marking all items as completed");
    t("should allow un-marking all items as completed");
    t("should keep the 'complete all' checkbox updated");
  });

  t.describe("Item", () => {
    t("should allow marking items as complete");
    t("should allow un-marking items as complete");
    t("should allow editing items");
    t("should show the remove item button on hover");
  });

  t.describe("Editing", () => {
    t("should hide other controls when editing");
    t("should save edits on enter");
    t("should save edits on blur");
    t("should trim entered text");
    t("should remove the item if an empty string is entered");
    t("should cancel edits on ESC");
  });

  t.describe("Counter", () => {
    t("should display the current number of items");
  });

  t.describe("Clear completed button", () => {
    t("should display the number of completed items");
    t("should remove completed items when clicked");
    t("should be hidden when there are no completed items");
  });

  t.describe("Persistence", () => {
    t("should persist state across reloads");
  });

  t.describe("Routing", () => {
    t("should allow filtering for active items");
    t("should allow filtering for completed items");
    t("should allow filtering for all items");
    t("should highlight the currently active filter");
  });
});


function getPage(src) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    const onerror = reject;
    const onload = () => resolve(new Page(iframe));
    document.body.appendChild(Object.assign(iframe, {onload, onerror, src}));
  });
}


class Page {
  constructor(iframe) {
    this.iframe = iframe;
    this.window = iframe.contentWindow;
    this.document = iframe.contentDocument;
  }

  first(selector, timeout)  { return this.waitFor(selector, "", timeout) }

  all(selector, timeout) { return this.waitFor(selector, "All", timeout) }

  async waitFor(selector, maybeAll, timeout = 0) {
    const now = Date.now();
    while (true) {
      const x = this.document["querySelector" + maybeAll](selector);
      if (maybeAll ? x.length : x) return x;
      else if (Date.now() - now > timeout) throw new Error(`timeout waiting for "${selector}"`);
      else await new Promise(r => requestAnimationFrame(r));
    }
  }
}

function enter(node, type = "keydown") {
  node.dispatchEvent(new KeyboardEvent(type, {key: "Enter"}));
}
