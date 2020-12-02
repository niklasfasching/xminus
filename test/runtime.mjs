import {t, done} from "../src/test.mjs";
import * as runtime from "../src/runtime.mjs";


t.describe("runtime", () => {
  t.exitAfter();

  function fragment(html = "") {
    const template = document.createElement("template");
    template.innerHTML = html;
    return new runtime.Fragment(template.content.childNodes);
  }

  t.describe("updateNodes", () => {
    const create = ($, value) => document.createTextNode(value);
    let parent, anchor, nodes;
    t.beforeEach(() => {
      parent = fragment();
      anchor = parent.firstChild;
      nodes = [];
    });

    t("should create nodes for new values (before the anchor)", () => {
      let values = [], updatedValues = ["a", "b", "c", "d", "e"];
      t.strictEqual(parent.childNodes[0], anchor);
      runtime.updateNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.strictEqual(values.length, updatedValues.length);
      t.strictEqual(nodes.length, updatedValues.length);
      t.strictEqual(parent.childNodes[parent.childNodes.length - 1], anchor);
      t.strictEqual(parent.childNodes.length, updatedValues.length + 1);
      t.strictEqual(parent.textContent, "abcde");
    });

    t("should remove nodes for removed values", () => {
      let values = [], updatedValues = ["a", "b", "c", "d", "e"];
      runtime.updateNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.strictEqual(parent.childNodes.length, updatedValues.length + 1);
      updatedValues = [];
      runtime.updateNodes(parent, anchor, nodes, values, [], "$", create);
      t.strictEqual(parent.childNodes.length, updatedValues.length + 1);
    });

    t("should replace or update nodes for changed values", () => {
      let values = [], updatedValues = ["a", "b", "c", "d", "e"], updated = false;
      runtime.updateNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.strictEqual(parent.childNodes.length, updatedValues.length + 1);
      nodes[0].update = () => updated = true;
      const node1 = nodes[1];
      updatedValues[0] = "0";
      runtime.updateNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.assert(updated);
      t.assert(node1 !== nodes[1]);
    });
  });

  t.describe("fragment", () => {
    let parent, fragment1, fragment2, p1, p2;
    t.beforeEach(() => {
      parent = document.createElement("div");
      p1 = document.createElement("p");
      p2 = document.createElement("p");
      fragment1 = fragment("<p>foo</p>bar<p>baz</p>");
      fragment2 = fragment("foo<p>bar</p>baz");
    })

    t("should support nextSibling when containing multiple child nodes", () => {
      parent.append(fragment1, p1);
      t.strictEqual(fragment1.nextSibling, p1);
      parent.insertBefore(p2, fragment1.nextSibling);
      t.strictEqual(fragment1.nextSibling, p2);
    });

    t("should support nextSibling and insertAfter when empty (i.e. be anchored)", () => {
      const emptyFragment = fragment();
      parent.append(emptyFragment, p1);
      t.strictEqual(emptyFragment.nextSibling, p1);
      parent.insertBefore(p2, emptyFragment.nextSibling);
      t.strictEqual(emptyFragment.nextSibling, p2);
    });
  });

  t.describe("mount", () => {
    t("smoke test", async () => {
      document.head.innerHTML += `<script type="x-module" src="./fixtures/index.html"></script>`;
      const parent = document.createElement("div");
      await runtime.mount(parent, "x-main", {});
    });
  });

  t.describe("if");
  t.describe("for");
  t.describe("on");
});
