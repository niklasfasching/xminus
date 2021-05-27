import {t, done} from "../src/test.mjs";
import * as runtime from "../src/runtime.mjs";
import * as compiler from "../src/compiler.mjs";


t.describe("runtime", () => {
  t.exitAfter();

  function fragment(html = "") {
    const template = document.createElement("template");
    template.innerHTML = "<!-- anchor -->" + html;
    return template.content;
  }

  t.describe("updateChildNodes", () => {
    const create = ($, value) => document.createTextNode(value);
    let parent, anchor, nodes;
    t.beforeEach(() => {
      parent = fragment();
      anchor = parent.firstChild;
      nodes = [];
    });

    t("should create nodes for new values (before the anchor)", () => {
      let values = [], updatedValues = ["a", "b", "c", "d", "e"];
      t.equal(parent.childNodes[0], anchor);
      runtime.updateChildNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.equal(values.length, updatedValues.length);
      t.equal(nodes.length, updatedValues.length);
      t.equal(parent.childNodes[parent.childNodes.length - 1], anchor);
      t.equal(parent.childNodes.length, updatedValues.length + 1);
      t.equal(parent.textContent, "abcde");
    });

    t("should remove nodes for removed values", () => {
      let values = [], updatedValues = ["a", "b", "c", "d", "e"];
      runtime.updateChildNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.equal(parent.childNodes.length, updatedValues.length + 1);
      updatedValues = [];
      runtime.updateChildNodes(parent, anchor, nodes, values, [], "$", create);
      t.equal(parent.childNodes.length, updatedValues.length + 1);
    });

    t("should replace or update nodes for changed values", () => {
      let values = [], updatedValues = ["a", "b", "c", "d", "e"], updated = false;
      runtime.updateChildNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.equal(parent.childNodes.length, updatedValues.length + 1);
      nodes[0][runtime.symbols.updateChildNode] = () => updated = true;
      const node1 = nodes[1];
      updatedValues[0] = "0";
      runtime.updateChildNodes(parent, anchor, nodes, values, updatedValues, "$", create);
      t.assert(updated);
      t.assert(node1 !== nodes[1]);
    });

    t("should update existing node given text value and replace it given node value", () => {
      const div = document.createElement("div"), p = document.createElement("p");
      let values = [], updatedValues = ["text", div];
      runtime.updateChildNodes(parent, anchor, nodes, values, updatedValues, "$", runtime.createChildNode);
      const [textNode, divNode] = nodes;
      updatedValues = ["updated text", p];
      runtime.updateChildNodes(parent, anchor, nodes, values, updatedValues, "$", runtime.createChildNode);
      t.assert(textNode === nodes[0]);
      t.assert(nodes[1] === p);
    });
  });

  t.describe("mount", () => {
    t("smoke test", async () => {
      const iframe = await openIframe(new URL("./fixtures/index.html#/foo?bar=baz", import.meta.url));
      await new Promise(r => setTimeout(r, 100));
      const p = iframe.contentDocument.querySelector("p"), div = iframe.contentDocument.querySelector("div");
      t.equal(p.innerText, "bar");
      t.equal(div.innerText, "x-main");
    });

    t("should handle html templates", async () => {
      eval(compiler.compile("x-y", `<x>{$.props.value}</x>`));
      const app = await runtime.mount(document.body, `<x-y {...$.props}></x-y><x-y {...$.props}></x-y>`, {value: 42});
      t.equal(app.innerHTML, `<x-y>42</x-y><x-y>42</x-y>`);
    });
  });

  t.describe("if");
  t.describe("for");
  t.describe("on");
});
