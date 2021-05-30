import {t, done} from "../src/test.mjs";
import * as compiler from "../src/compiler.mjs";
import * as runtime from "../src/runtime.mjs";
import * as parser from "../src/parser.mjs";

window.xm = runtime;

t.describe("compiler", () => {
  t.exitAfter();

  function run(method, ...args) {
    compiler.resetPrefixId();
    const $ = {html: "", create: "", update: ""};
    args = args.map(_ => _ === "$" ? $ : _);
    const result = compiler[method](...args);
    return {
      result: result?.indexOf("\n") ? result.split(/\n\s*/g) : result,
      html: $.html.indexOf("\n") !== -1 ? $.html.split(/\n\s*/g) : $.html,
      create: $.create.indexOf("\n") !== -1 ? $.create.split(/\n\s*/g) : $.create,
      update: $.update.indexOf("\n") !== -1 ? $.update.split(/\n\s*/g) : $.update,
    };
  }

  t.describe("generateVnode", () => {
    function test(template) {
      const vnodes = parser.parse(template);
      const vnode = vnodes[0];
      t.equal(vnodes.length, 1);
      vnode.ref = "root";
      vnode.parent = {children: [vnode]};
      t.assertFixture(run("generateVnode", vnode, "$", "_x_"));
    }

    t("should not generate update code for static html", () => {
      test(`<div>hello <b>world</b></div>`);
    });

    t("should generate create and update code for dynamic properties", () => {
      test(`<div {dynamic key}=value key={dynamic value}>hello world</div>`);
    });

    t("should generate create and update code for dynamic children", () => {
      test(`<div>hello {dynamic child}</div>`);
    });

    t("should generate void tags without children", () => {
      test(`<div><input>{not a child of input}</div>`);
    });

    t("should generate component tags", () => {
      test(`<x-component {dynamic key}=value key={dynamic value}>foo bar {baz}</x-component>`);
    });

    t("should generate nested dynamic children", () => {
      test(`<div><div>{foo bar}</div>{baz}</div>`);
    });

    t.describe("macro", () => {
      t("should generate .on macro", () => {
        test(`<div key={dynamic value} .on:click="console.log('magic')"></div>`);
      });

      t("should generate .on:create macro", () => {
        test(`<div .on:create="console.log('magic')"></div>`);
      });

      t("should generate .on:update macro", () => {
        test(`<div .on:update="console.log('magic')"></div>`);
      });

      t("should generate .on macro with no(update) modifier", () => {
        test(`<div .on:update:no="console.log('magic')"></div>`);
      });

      t("should generate .bind: macro", () => {
        test(`<div .bind:value="$.value"></div>`);
      });

      t("should generate .bind: macro for input elements", () => {
        test(`<div>
                    <input .bind:value="$.value">
                    <textarea .bind:value="$.value"></textarea>
                    <select .bind:value="$.value"><option>foo</option></select>
                  </div>`);
      });

      t("should generate .for macro", () => {
        test(`<div key={dynamic value} .for="item in $.items"></div>`);
      });

      t("should generate .if macro", () => {
        test(`<div key={dynamic value} .if="$.condition"></div>`);
      });

      t("should generate .inject macro", () => {
        test(`<div .inject:x-component="x"></div>`);
      });

      t("should generate .class macro", () => {
        test(`<div class="class-0" ..class-1 ..class-2 ..class-3></div>`);
      });

      t("should generate conditional .class macro", () => {
        test(`<div ..conditional="$.condition" ..{$.conditionalClass}="$.condition"></div>`);
      });

      t("should generate .class macro with dynamic classes", () => {
        test(`<div class="class-0" ..{"dynamic-class-1"} ..class-2 ..class-3></div>`);
      });

      t("should generate --cssVar macro", () => {
        test(`<div --x="$.x" --{$.conditionalVar}=$.var></div>`);
      });

      t("should generate #id macro", () => {
        test(`<div #id></div>`);
      });
    });
  });

  t.describe("compile", () => {
    function test(template, attributes = "") {
      t.assertFixture(run("compile", "x-foo-component", `<element ${attributes}>${template}</element>`));
    }

    t("should generate a component (smoke test)", () => {
      test("<div></div>");
    });

    t("should generate element attributes (except id, type bc used by template) from template attributes", () => {
      test(`<p>hello {world}</p>`, `id="x-foo" type="x-template" {foo}={bar}`);
    });

    t("should support splat properties on child components", () => {
      test(`<x-child key=value {...$.props} />`);
    });

    t("should throw on splat properties on non child-components", () => {
      t.throws(() => run("compile", "x-foo-component", `<element><div {...$.props}></div></element>`),
               /splat properties.*<div>/);
    });

  });

  t.describe("integration", () => {
    let template = document.createElement("template"), id = 0;
    function render(props, template) {
      const name = `x-component-${id++}`;
      eval(compiler.compile(name, `<element x-props="${Object.keys(props).join(" ")}">${template}</element>`));
      const component = document.createElement(name);
      document.body.append(component);
      component.init(component, component, props);
      return [component, props => component.update(props)];
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

    t("should update for child nodes", () => {
      eval(compiler.compile("x-for-foo", `<element>{$.props.x}</element>`));
      const [component, update] = render({xs: [1, 2]}, `<x-for-foo x={x} .for="x of $.xs"/>`);
      t.equal(component.innerHTML, `<x-for-foo>1</x-for-foo><x-for-foo>2</x-for-foo><!---->`);
      update({xs: [3, 4, 5]});
      t.equal(component.innerHTML, `<x-for-foo>3</x-for-foo><x-for-foo>4</x-for-foo><x-for-foo>5</x-for-foo><!---->`);
      update({xs: [6]});
      t.equal(component.innerHTML, `<x-for-foo>6</x-for-foo><!---->`);
    });

    t("should update nested components", () => {
      eval(compiler.compile("x-foo", `<element x-props="key key1"><p>a</p>{$.key} {$.xSlot} {$.key1}<p>c</p></element>`));
      const [component, update] = render({key: "key1", value: "key1-value1", child: "child1"},
                                         `<x-foo {$.key}={$.value} key=key-value1>{$.child}</>`);
      t.equal(component.innerHTML, `<x-foo><p>a</p>key-value1 <div class="slot">child1</div> key1-value1<p>c</p></x-foo>`);
      update({key: "key1", value: "key1-value2", child: "child2"});
      t.equal(component.innerHTML, `<x-foo><p>a</p>key-value1 <div class="slot">child2</div> key1-value2<p>c</p></x-foo>`);
    });

    t("should inject parent components", () => {
      eval(compiler.compile("x-parent", `<element><x-child></x-child></element>`));
      eval(compiler.compile("x-child", `<element .inject:x-parent="xParent"></element>`));
      const [component, update] = render({}, `<x-parent></x-parent>`);
      t.assert(component.querySelector("x-child").xParent);
    });

    t("should update dynamic component tags");
  });

});
