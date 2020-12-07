import {t, done} from "../src/test.mjs";
import * as compiler from "../src/compiler.mjs";
import * as runtime from "../src/runtime.mjs";
import * as parser from "../src/parser.mjs";

window.xm = runtime;

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

      t("should generate .bind: macro", (id) => {
        test(id, `<div .bind:value="$.value"></div>`);
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

  t.describe("compile", () => {
    t("should compile into a single html file (smoke test)", async (id) => {
      const html = await compiler.compile("./fixtures/index.html");
      assertFixture({id, html: html.split(/\n\s*/g)});
    })
  });


  t.describe("loadModule", () => {
    function dataUrl(string) {
      return `data:text/javascript,${encodeURIComponent(string)}`;
    }

    const childModule = `<script type=x-template id=x-child>{child}</script>
                         <script type=module>child</script>`;
    const module = `<script type=x-template id=x-parent>{parent}</script>
                    <script type=x-module src="${dataUrl(childModule)}"></script>
                    <script type=module>parent</script>`;
    t("should load modules recursively", async () => {
      const loadedModules = await compiler.loadModule(dataUrl(module));
      t.equal(loadedModules.length, 2);
      t.jsonEqual(loadedModules.map(m => m.code), ["parent", "child"]);
      t.jsonEqual(loadedModules.map(m => m.componentTemplates), [
        [{name: "x-parent", content: "{parent}"}],
        [{name: "x-child", content: "{child}"}],
      ]);
    });

    t("should deduplicate modules / load each module only once", async () => {
      const duplicates = `${module}
                          <script type=x-module src="${dataUrl(childModule)}"></script>
                          <script type=x-module src="${dataUrl(childModule)}"></script>`;
      const loadedModules = await compiler.loadModule(dataUrl(duplicates));
      t.equal(loadedModules.length, 2);
    });

    t("should allow only one non-src module script per module", async () => {
      const module = `<script type=module></script>
                      <script type=module></script>`;
      await t.throws(async () => await compiler.loadModule(dataUrl(module)),
                     /One module per file/);
    });

    t("should convert relative to absolute imports inside module scripts", async () => {
      const module = `<script type=module>
                      import "./foo.js";
                      import "/bar.js";
                      </script>`;
      const loadedModules = await compiler.loadModule(dataUrl(module));
      t.assert(loadedModules[0].code.includes("/test/foo.js"));
      t.assert(loadedModules[0].code.includes("/bar.js"));
    });

    t("should remove xminus elements from document", async () => {
      const loadedModules = await compiler.loadModule(dataUrl(module));
      t.equal(loadedModules[0].document.querySelectorAll("[type*=x-]").length, 0);
    });
  });

  t.describe("integration", () => {
    function render($, template) {
      eval(compiler.generateComponent("x-component", template));
      const [fragment, update] = xm.components["x-component"]($);
      const div = document.createElement("div");
      div.append(fragment);
      return [div, $$ => {
        Object.assign($, $$);
        update();
      }];
    }

    t("should update dynamic properties", () => {
      const [div, update] = render({key1: "key1a", key2: "key2a", value: "value1"},
                                        `<div key={$.value} {$.key1}=normal-value {$.key2}={$.value}/>`);
      t.equal(div.firstChild.outerHTML, `<div key="value1" key1a="normal-value" key2a="value1"></div>`);
      update({key1: "key1b", key2: "key2b", value: "value2"});
      t.equal(div.firstChild.outerHTML, `<div key="value2" key1b="normal-value" key2b="value2"></div>`);
    });

    t("should update dynamic children", () => {
      const [div, update] = render({child1: "child1a", child2: "child2a"},
                                        `<div>{$.child1} and {$.child2}</div>`);
      t.equal(div.firstChild.outerHTML, `<div>child1a and child2a</div>`);
      update({child1: "child1b", child2: "child2b"});
      t.equal(div.firstChild.outerHTML, `<div>child1b and child2b</div>`);
    });

    t("should update nested dynamic children", () => {
      const [div, update] = render({child1: "child1a", child2: "child2a", child3: "child3a"},
                                        `<div>{$.child1} and <b>{$.child2}</b> and {$.child3}</div>`);
      t.equal(div.firstChild.outerHTML, `<div>child1a and <b>child2a</b> and child3a</div>`);
      update({child1: "child1b", child2: "child2b", child3: "child3b"});
      t.equal(div.firstChild.outerHTML, `<div>child1b and <b>child2b</b> and child3b</div>`);
    });

    t("should update fragment children", () => {
      const childFragment = Object.assign(document.createElement('template'),
                                          {innerHTML: `<p>a</p> <p>b</p>`}).content;
      const [div, update] = render({child1: "child1a", childFragment, child3: "child2a"},
                                        `<div>{$.child1}, {$.childFragment} and {$.child3}</div>`);
      t.equal(div.firstChild.outerHTML, `<div>child1a, <p>a</p> <p>b</p><!--fragment anchor--> and child2a</div>`);
      update({child1: "child1b", childFragment, child3: "child2b"});
      t.equal(div.firstChild.outerHTML, `<div>child1b, <p>a</p> <p>b</p><!--fragment anchor--> and child2b</div>`);
      const childFragment2 = Object.assign(document.createElement('template'),
                                           {innerHTML: `<p>a2</p> <p>b2</p>`}).content;
      update({child1: "child1b", childFragment: childFragment2, child3: "child2b"});
      t.equal(div.firstChild.outerHTML, `<div>child1b, <p>a2</p> <p>b2</p><!--fragment anchor--> and child2b</div>`);
    });

    t("should update nested components", () => {
      eval(compiler.generateComponent("x-foo", `<p>a</p>{properties.key} {children} {properties.key1}<p>c</p>`));
      const [div, update] = render({key: "key1", value: "key1-value1", child: "child1"},
                                   `<x-foo {$.key}={$.value} key=key-value1>{$.child}</>`);
      t.equal(div.innerHTML, `<p>a</p>key-value1 child1<!--fragment anchor--> key1-value1<p>c</p><!--fragment anchor--><!--fragment anchor-->`);
      update({key: "key1", value: "key1-value2", child: "child1"});
      t.equal(div.innerHTML, `<p>a</p>key-value1 child1<!--fragment anchor--> key1-value2<p>c</p><!--fragment anchor--><!--fragment anchor-->`);
    });

    t("should update dynamic component tags", () => {
      eval(compiler.generateComponent("x-foo", `<p>a</p>{properties.key}<p>c</p>`));
      eval(compiler.generateComponent("x-bar", `<b>d</b>{properties.key}`));
      const [div, update] = render({tag: "x-foo"}, `<{$.tag} key=value/>`);
      t.equal(div.innerHTML, `<p>a</p>value<p>c</p><!--fragment anchor--><!--fragment anchor-->`);
      update({tag: "x-bar"});
      t.equal(div.innerHTML, `<b>d</b>value<!--fragment anchor--><!--fragment anchor-->`);
      update({tag: "x-foo"});
      t.equal(div.innerHTML, `<p>a</p>value<p>c</p><!--fragment anchor--><!--fragment anchor-->`);
      t.throws(() => update({tag: "div"}), /component not found: div/)
    });
  });

});
