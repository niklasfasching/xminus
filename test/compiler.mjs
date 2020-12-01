import {t, done} from "../src/test.mjs";
import * as compiler from "../src/compiler.mjs";
import * as parser from "../src/parser.mjs";

t.describe("compiler", () => {
  t.exitAfter();

  const assertFixture = t.setupFixtures("./fixtures/compiler.json");

  function run(id, method, ...args) {
    compiler.resetPrefixId();
    const $ = {html: "", create: "", update: ""};
    args = args.map(_ => _ === "$" ? $ : _);
    const result = compiler[method](...args);
    return {
      id,
      result: result?.indexOf("\n") ? result.split(/\n\s*/g) : result,
      html: $.html.indexOf("\n") !== -1 ? $.html.split(/\n\s*/g) : $.html,
      create: $.create.indexOf("\n") !== -1 ? $.create.split(/\n\s*/g) : $.create,
      update: $.update.indexOf("\n") !== -1 ? $.update.split(/\n\s*/g) : $.update,
    };
  }

  t.describe("generateVnode", () => {
    function test(id, template) {
      const vnodes = parser.parse(template);
      const vnode = vnodes[0];
      t.strictEqual(vnodes.length, 1);
      vnode.node = "root";
      vnode.parent = {children: [vnode]};
      assertFixture(run(id, "generateVnode", vnode, "$", "_x_"));
    }

    t("should not generate update code for static html", (id) => {
      test(id, `<div>hello <b>world</b></div>`);
    });

    t("should generate create and update code for dynamic properties", (id) => {
      test(id, `<div {dynamic key}=value key={dynamic value}>hello world</div>`);
    });

    t("should generate create and update code for dynamic children", (id) => {
      test(id, `<div>hello {dynamic child}</div>`);
    });

    t("should generate void tags without children", (id) => {
      test(id, `<div><input>{not a child of input}</div>`);
    });

    t("should generate component tags", (id) => {
      test(id, `<x-component {dynamic key}=value key={dynamic value}>foo bar {baz}</x-component>`);
    });

    t("should generate nested dynamic children", (id) => {
      test(id, `<div><div>{foo bar}</div>{baz}</div`);
    });

    t.describe("macro", () => {
      t("should generate .on macro", (id) => {
        test(id, `<div key={dynamic value} .on:click="console.log('magic')"></div>`);
      });

      t("should generate .for macro", (id) => {
        test(id, `<div key={dynamic value} .for="item in $.items"></div>`);
      });

      t("should generate .if macro", (id) => {
        test(id, `<div key={dynamic value} .if="$.condition"></div>`);
      });
    });
  });

  t.describe("generateComponent", () => {
    function test(id, template) {
      assertFixture(run(id, "generateComponent", "x-foo-component", template));
    }

    t("should generate a component (smoke test)", (id) => {
      test(id, "<div></div>")
    });
  });

});
