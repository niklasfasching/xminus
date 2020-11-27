import {t, done} from "../src/test.mjs";

done.then(({countFailed}) => {
  window.close(countFailed && 1)
});

t.describe("TodoMVC", () => {

  let iframe, input;
  t.beforeEach(async () => {
    if (iframe?.parentElement) iframe.parentElement.removeChild(iframe);
    iframe = await openIframe("./todomvc.html");
    input = await first(iframe, "input");
  });

  t.describe("Initial load", () => {
    t("should focus todo input", async () => {
      t.assertStrictEqual(iframe.contentDocument.activeElement, input);
    });
  });

  t.describe("Empty Todos", () => {
    t("should hide $main and $footer when there are no todos", async () => {
      t.assert(isHidden(await first(iframe, ".main")));
      t.assert(isHidden(await first(iframe, ".footer")));
    });
  });

  t.describe("New Todo", () => {
    const title1 = "try to take over the world";
    const title2 = "eat some pudding";
    let items;
    t.beforeEach(async () => {
      input.value = `  ${title1}  `;
      enter(input);
      input.value = `  ${title2}  `;
      enter(input);
      items = await all(iframe, ".todo-item");
    });

    t("should add todo items in order", () => {
      t.assertEqual(items.length, 2);
      t.assertEqual(items[0].innerText, title1);
      t.assertEqual(items[1].innerText, title2);
    });

    t("should clear input after an item is added", () => {
      t.assertEqual(items.length, 2);
      t.assertEqual(input.value, "");
    });

    t("should trim entered text", () => {
      t.assertEqual(items[0].innerText, title1);
      t.assertEqual(iframe.contentWindow.store.items[0].title, title1);
    });

    t("should show $main and $footer when there are todos", async () => {
      t.assert(!isHidden(await first(iframe, ".main")));
      t.assert(!isHidden(await first(iframe, ".footer")));
    });
  });

  t.describe("Mark all as completed", () => {
    let items, toggleAll;
    t.beforeEach(async () => {
      for (let title of ["a", "b", "c"]) {
        input.value = title;
        enter(input);
      }
      items = await all(iframe, ".todo-item");
      toggleAll = await first(iframe, ".toggle-all");
    });

    t("should allow marking all items as completed", () => {
      for (let item of items) t.assert(!item.classList.contains("completed"));
      toggleAll.click()
      for (let item of items) t.assert(item.classList.contains("completed"));
    });

    t("should allow un-marking all items as completed", () => {
      for (let item of items) t.assert(!item.classList.contains("completed"));
      toggleAll.click()
      toggleAll.click()
      for (let item of items) t.assert(!item.classList.contains("completed"));
    });

    t("should keep the 'complete all' checkbox updated", () => {
      t.assertEqual(toggleAll.checked, false);
      toggleAll.click()
      t.assertEqual(toggleAll.checked, true);
    });
  });

  t.describe("Item", () => {
    let item;
    t.beforeEach(async () => {
      input.value = "title";
      enter(input);
      item = await first(iframe, ".todo-item");
    });

    t("should allow marking items as complete", () => {
      t.assertEqual(item.querySelector(".toggle").checked, false);
      item.querySelector(".toggle").click();
      t.assertEqual(item.querySelector(".toggle").checked, true);
    });

    t("should allow un-marking items as complete", () => {
      item.querySelector(".toggle").click();
      item.querySelector(".toggle").click();
      t.assertEqual(item.querySelector(".toggle").checked, false);
    });

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


function first(iframe, selector, timeout) {
  return waitFor(iframe, selector, "", timeout);
}

function all(iframe, selector, timeout) {
  return waitFor(iframe, selector, "All", timeout)
}

async function waitFor(iframe, selector, maybeAll, timeout = 500) {
    const now = Date.now();
    while (true) {
      const x = iframe.contentDocument["querySelector" + maybeAll](selector);
      if (maybeAll ? x.length : x) return x;
      else if (Date.now() - now > timeout) return null;
      else await new Promise(r => requestAnimationFrame(r));
    }
  }

function enter(node, type = "keydown") {
  node.dispatchEvent(new KeyboardEvent(type, {key: "Enter"}));
}

function isHidden(node) {
  if (!node) return true;
  return window.getComputedStyle(node).display === 'none';
}
