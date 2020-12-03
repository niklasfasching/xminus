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

});
