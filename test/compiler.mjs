import {t, done} from "../src/test.mjs";
import * as compiler from "../src/compiler.mjs";
import * as runtime from "../src/runtime.mjs";
import * as parser from "../src/parser.mjs";

window.xm = runtime;

t.describe("compiler", () => {
  t.exitAfter();

  const assertFixture = t.setupFixtures(new URL("./fixtures/compiler.json", import.meta.url));

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
      t.equal(vnodes.length, 1);
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

      t("should generate .on:create macro", (id) => {
        test(id, `<div .on:create="console.log('magic')"></div>`);
      });

      t("should generate .on:update macro", (id) => {
        test(id, `<div .on:update="console.log('magic')"></div>`);
      });

      t("should generate .on macro with no(update) modifier", (id) => {
        test(id, `<div .on:update:no="console.log('magic')"></div>`);
      });

      t("should generate .bind: macro", (id) => {
        test(id, `<div .bind:value="$.value"></div>`);
      });

      t("should generate .bind: macro for input elements", (id) => {
        test(id, `<div>
                    <input .bind:value="$.value">
                    <textarea .bind:value="$.value"></textarea>
                    <select .bind:value="$.value"><option>foo</option></select>
                  </div>`);
      });

      t("should generate .for macro", (id) => {
        test(id, `<div key={dynamic value} .for="item in $.items"></div>`);
      });

      t("should generate .if macro", (id) => {
        test(id, `<div key={dynamic value} .if="$.condition"></div>`);
      });
    });
  });

  t.describe("compile", () => {
    function test(id, template) {
      assertFixture(run(id, "compile", "x-foo-component", template));
    }

    t("should generate a component (smoke test)", (id) => {
      test(id, "<div></div>")
    });
  });

  t.describe("integration", () => {
    let template = document.createElement("template"), id = 0;
    function render($, template) {
      const name = `x-component-${id++}`;
      eval(compiler.compile(name, template));
      const component = document.createElement(name);
      Object.assign(component, {
        _props: {},
        _$: Object.assign($, {$update: () => component.updateComponent()}),
      });
      document.body.append(component)
      return [component, $$ => {
        Object.assign($, $$);
        component.updateCallback();
      }];
    }

    t("should update dynamic properties", () => {
      const [component, update] = render({key1: "key1a", key2: "key2a", value: "value1"},
                                         `<div key={$.value} {$.key1}=normal-value {$.key2}={$.value}/>`);
            t.equal(component.innerHTML, `<div key="value1" key1a="normal-value" key2a="value1"></div>`);
      update({key1: "key1b", key2: "key2b", value: "value2"});
      t.equal(component.innerHTML, `<div key="value2" key1b="normal-value" key2b="value2"></div>`);
    });

    t("should update dynamic children", () => {
      const [component, update] = render({child1: "child1a", child2: "child2a"},
                                         `<div>{$.child1} and {$.child2}</div>`);
      t.equal(component.innerHTML, `<div>child1a and child2a</div>`);
      update({child1: "child1b", child2: "child2b"});
      t.equal(component.innerHTML, `<div>child1b and child2b</div>`);
    });

    t("should update nested dynamic children", () => {
      const [component, update] = render({child1: "child1a", child2: "child2a", child3: "child3a"},
                                        `<div>{$.child1} and <b>{$.child2}</b> and {$.child3}</div>`);
      t.equal(component.innerHTML, `<div>child1a and <b>child2a</b> and child3a</div>`);
      update({child1: "child1b", child2: "child2b", child3: "child3b"});
      t.equal(component.innerHTML, `<div>child1b and <b>child2b</b> and child3b</div>`);
    });

    t("should update child node", () => {
      const childNode = Object.assign(document.createElement('div'),
                                      {innerHTML: `<p>a</p> <p>b</p>`});
      const [component, update] = render({child1: "child1a", childNode, child3: "child2a"},
                                         `<div>{$.child1}, {$.childNode} and {$.child3}</div>`);
      t.equal(component.innerHTML, `<div>child1a, <div><p>a</p> <p>b</p></div> and child2a</div>`);
      update({child1: "child1b", childNode, child3: "child2b"});
      t.equal(component.innerHTML, `<div>child1b, <div><p>a</p> <p>b</p></div> and child2b</div>`);
      const childNode2 = Object.assign(document.createElement('div'),
                                       {innerHTML: `<p>a2</p> <p>b2</p>`});
      update({child1: "child1b", childNode: childNode2, child3: "child2b"});
      t.equal(component.innerHTML, `<div>child1b, <div><p>a2</p> <p>b2</p></div> and child2b</div>`);
    });

    t("should update nested components", () => {
      eval(compiler.compile("x-foo", `<p>a</p>{props.key} {slot} {props.key1}<p>c</p>`));
      const [component, update] = render({key: "key1", value: "key1-value1", child: "child1"},
                                         `<x-foo {$.key}={$.value} key=key-value1>{$.child}</>`);
      t.equal(component.innerHTML, `<x-foo><p>a</p>key-value1 <div class="slot">child1</div> key1-value1<p>c</p></x-foo>`);
      update({key: "key1", value: "key1-value2", child: "child2"});
      t.equal(component.innerHTML, `<x-foo><p>a</p>key-value1 <div class="slot">child2</div> key1-value2<p>c</p></x-foo>`);
    });

    t("should update dynamic component tags");
  });

});
