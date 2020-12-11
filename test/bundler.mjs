import * as bundler from "/src/bundler.mjs";
import {t} from "/src/test.mjs";

const dataUrl = bundler.dataUrl;

t.describe("bundler", () => {
  t.exitAfter();

  const assertFixture = t.setupFixtures(new URL("./fixtures/bundler.json", import.meta.url));

  t.describe("loadModules", () => {
    const childModule = `<script type=x-template id=x-child>{child}</script>
                         <script type=module>child</script>`;
    const module = `<script type=x-template id=x-parent>{parent}</script>
                    <script type=x-module src="${dataUrl(childModule)}"></script>
                    <script type=module>parent</script>`;

    t("should load modules recursively", async () => {
      const loadedModules = await bundler.loadModule(dataUrl(module));
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
      const loadedModules = await bundler.loadModule(dataUrl(duplicates));
      t.equal(loadedModules.length, 2);
    });

    t("should allow only one non-src module script per module", async () => {
      const module = `<script type=module></script>
                      <script type=module></script>`;
      await t.throws(async () => await bundler.loadModule(dataUrl(module)),
                     /One module per file/);
    });

    t("should convert relative to absolute imports inside module scripts", async () => {
      const module = `<script type=module>
                      import "./foo.js";
                      import "/bar.js";
                      </script>`;
      const loadedModules = await bundler.loadModule(dataUrl(module));
      t.assert(loadedModules[0].code.includes("/foo.js"));
      t.assert(loadedModules[0].code.includes("/bar.js"));
    });

    t("should remove xminus elements from document", async () => {
      const loadedModules = await bundler.loadModule(dataUrl(module));
      t.equal(loadedModules[0].document.querySelectorAll("[type*=x-]").length, 0);
    });

    t("should bundle into a single html file (smoke test)", async (id) => {
      const html = await bundler.bundle(new URL("./fixtures/index.html", import.meta.url));
      assertFixture({id, html: html.split(/\n\s*/g)});
    });
  });
});
