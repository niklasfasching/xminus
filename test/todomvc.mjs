import {t} from "../src/test.mjs";

t.describe("TodoMVC", () => {

  t.describe("Empty Todos", () => {
    t("should hide #main and #footer when there are no todos");
  });

  t.describe("New Todo", () => {
    t("should add todo items");
    t("should clear input after an item is added");
    t("should trim entered text");
    t("should show #main and #footer when there are todos");
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
