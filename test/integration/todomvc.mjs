import {t, done} from "/src/test.mjs";


t.describe("TodoMVC", () => {
  t.exitAfter();

  let iframe, input;
  t.beforeEach(async () => {
    localStorage.setItem("items", "[]");
    if (iframe?.parentElement) iframe.parentElement.removeChild(iframe);
    iframe = await openIframe("./todomvc.html");
    input = await first(iframe, "input");
  });



  t.describe("Initial load", () => {
    t("should focus todo input", async () => {
      t.equal(iframe.contentDocument.activeElement, input);
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
      t.equal(items.length, 2);
      t.equal(items[0].innerText, title1);
      t.equal(items[1].innerText, title2);
    });

    t("should clear input after an item is added", () => {
      t.equal(items.length, 2);
      t.equal(input.value, "");
    });

    t("should trim entered text", () => {
      t.equal(items[0].innerText, title1);
      t.equal(iframe.contentWindow.store.items[0].title, title1);
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
      items[0].querySelector(".toggle").click()
      t.assert(!items[0].classList.contains("completed"));
      t.assert(!toggleAll.checked);
      toggleAll.click();
      for (let item of items) t.assert(item.classList.contains("completed"));
    });

    t("should allow un-marking all items as completed", () => {
      for (let item of items) t.assert(!item.classList.contains("completed"));
      toggleAll.click()
      toggleAll.click()
      for (let item of items) t.assert(!item.classList.contains("completed"));
    });

    t("should keep the 'complete all' checkbox updated", () => {
      t.equal(toggleAll.checked, false);
      toggleAll.click()
      t.equal(toggleAll.checked, true);
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
      t.equal(item.querySelector(".toggle").checked, false);
      item.querySelector(".toggle").click();
      t.equal(item.querySelector(".toggle").checked, true);
    });

    t("should allow un-marking items as complete", () => {
      item.querySelector(".toggle").click();
      item.querySelector(".toggle").click();
      t.equal(item.querySelector(".toggle").checked, false);
    });

    t("should allow editing items", () => {
      item.querySelector("label").dispatchEvent(new MouseEvent("dblclick"));
      t.assert(item.querySelector("input.edit"));
    });

    // :hover can't be triggered in js. also this is testing css. ignored
    // t("should show the remove item button on hover");
  });

  t.describe("Editing", () => {
    let item, editInput;
    t.beforeEach(async () => {
      input.value = "title";
      enter(input);
      item = await first(iframe, ".todo-item");
      item.querySelector("label").dispatchEvent(new MouseEvent("dblclick"));
      editInput = item.querySelector("input.edit");
    });

    t("should hide other controls when editing", () => {
      t.assert(item.querySelector("input.edit"));
      t.assert(!item.querySelector("label"));
    });

    t("should save edits on enter", () => {
      editInput.value = "updated title";
      enter(editInput);
      t.equal(item.querySelector("label").textContent, "updated title");
    });

    t("should save edits on blur", () => {
      editInput.value = "updated title";
      editInput.dispatchEvent(new Event("blur"))
      t.equal(item.querySelector("label").textContent, "updated title");
    });

    t("should trim entered text", () => {
      editInput.value = "  updated title  ";
      enter(editInput);
      t.equal(item.querySelector("label").textContent, "updated title");
    });

    t("should remove the item if an empty string is entered", async () => {
      editInput.value = "  ";
      enter(editInput);
      t.assert(!await first(iframe, ".todo-item"));
    });

    t("should cancel edits on ESC", () => {
      const title = item.title;
      editInput.value = "  ";
      editInput.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
      t.assert(!item.querySelector("input.edit"))
      t.assert(item.querySelector("label"))
      t.equal(item.title, title);
    });
  });

  t.describe("Counter", () => {
    t("should display the current number of items", async () => {
      for (let i = 1; i <= 5; i++) {
        input.value = `hello`;
        enter(input);
        let items = await all(iframe, ".todo-item");
        let count = await first(iframe, ".todo-count");
        t.equal(items.length, i);
        t.equal(count.innerText, `${i}`);
      }
      for (let i = 1; i <= 4; i++) {
        let button = await first(iframe, ".todo-item .destroy");
        button.click();
        let count = await first(iframe, ".todo-count");
        t.equal(count.innerText, `${5 - i}`);
      }
    });
  });

  t.describe("Clear completed button", () => {

    t.beforeEach(async () => {
      for (let i = 0; i < 10; i++) {
        input.value = `todo ${i+1}`;
        enter(input);
      }
    });

    // doesn't look like it's implemented in the actual todomvcs
    // t("should display the number of completed items");

    t("should remove completed items when clicked", async () => {
      let items = await all(iframe, ".todo-item");
      t.equal(items.length, 10);
      items[0].querySelector(".toggle").click();
      items[3].querySelector(".toggle").click();
      const clearCompleted = await first(iframe, ".clear-completed");
      clearCompleted.click();
      items = await all(iframe, ".todo-item");
      t.equal(items.length, 8);
    });

    t("should be hidden when there are no completed items", async () => {
      let items = await all(iframe, ".todo-item");
      t.assert(!await first(iframe, ".clear-completed"));
      items[0].querySelector(".toggle").click();
      t.assert(await first(iframe, ".clear-completed"));
    });
  });

  t.describe("Persistence", () => {
    t("should persist state across reloads", async () => {
      for (let i = 0; i < 10; i++) {
        input.value = `todo ${i+1}`;
        enter(input);
      }
      const items = await all(iframe, ".todo-item");
      t.equal(items.length, 10);

      const iframe2 = await openIframe("./todomvc.html");
      const items2 = await all(iframe2, ".todo-item");
      t.equal(items2.length, 10);
    });
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

async function waitFor(iframe, selector, maybeAll, timeout = 100) {
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
